// Busca en Wikimedia Commons fotos candidatas para cada destino y estación, y arma una
// página para elegirlas:   npm run buscar-fotos   →   abrí fotos-candidatas.html
// Solo muestra fotos horizontales, de 1600 px o más, con licencias que permiten uso
// comercial y modificación (CC BY, CC BY-SA, CC0 o dominio público).
// Al elegir, la página arma el contenido de src/data/fotos-estacion.json para copiar y pegar.

import { readFile, writeFile } from 'node:fs/promises';

const UA = 'ArgentinaTodoElAno/0.1 (https://github.com/NicoChandia; sitio de datos abiertos)';

const BUSQUEDAS = {
  bariloche: {
    verano: ['Nahuel Huapi lake summer', 'Llao Llao Bariloche', 'Bariloche lake beach'],
    otono: ['Bariloche autumn', 'Nahuel Huapi autumn', 'Bariloche otoño'],
    invierno: ['Cerro Catedral snow', 'Bariloche snow', 'Cerro Otto snow'],
    primavera: ['Lupinus Bariloche', 'lupines Patagonia', 'Bariloche spring'],
  },
  'san-martin-de-los-andes': {
    verano: ['Lago Lácar', 'Siete Lagos Neuquén', 'Lago Correntoso'],
    otono: ['Lanín autumn', 'San Martín de los Andes otoño', 'Huechulafquen'],
    invierno: ['Chapelco', 'San Martín de los Andes snow', 'Lanín snow'],
    primavera: ['Lanín volcano', 'Lago Lolog', 'Quila Quina'],
  },
  'el-chalten': {
    verano: ['Laguna de los Tres', 'Fitz Roy summer', 'El Chaltén'],
    otono: ['El Chaltén autumn', 'Nothofagus pumilio autumn', 'lenga autumn Patagonia'],
    invierno: ['El Chaltén winter', 'Fitz Roy snow', 'El Chaltén snow'],
    primavera: ['Laguna Torre', 'Cerro Torre', 'Lago del Desierto'],
  },
  'el-calafate': {
    verano: ['Perito Moreno glacier', 'Upsala glacier', 'Lago Argentino'],
    otono: ['El Calafate autumn', 'Los Glaciares National Park autumn', 'Lago Roca'],
    invierno: ['Perito Moreno winter', 'Perito Moreno snow', 'El Calafate snow'],
    primavera: ['Spegazzini glacier', 'El Calafate', 'Perito Moreno Glacier walkways'],
  },
  ushuaia: {
    verano: ['Isla Martillo penguins', 'Beagle Channel Ushuaia', 'Les Eclaireurs lighthouse'],
    otono: ['Tierra del Fuego National Park autumn', 'Ushuaia autumn', 'Lapataia'],
    invierno: ['Ushuaia snow', 'Cerro Castor', 'Ushuaia winter'],
    primavera: ['Laguna Esmeralda Ushuaia', 'Martial glacier Ushuaia', 'Ushuaia harbour'],
  },
  mendoza: {
    verano: ['Aconcagua', 'Potrerillos Mendoza', 'Mendoza river rafting'],
    otono: ['Mendoza vineyard autumn', 'Vendimia Mendoza', 'Valle de Uco autumn'],
    invierno: ['Puente del Inca snow', 'Los Penitentes Mendoza', 'Aconcagua snow'],
    primavera: ['Mendoza vineyards', 'Luján de Cuyo bodega', 'Valle de Uco'],
  },
  'puerto-madryn': {
    verano: ['Punta Tombo penguins', 'Spheniscus magellanicus Punta Tombo', 'Puerto Madryn beach'],
    otono: ['Punta Norte orca', 'Orcinus orca Península Valdés', 'sea lions Península Valdés'],
    invierno: ['Eubalaena australis Península Valdés', 'whale Puerto Pirámides', 'El Doradillo'],
    primavera: ['Mirounga leonina Península Valdés', 'elephant seal Península Valdés', 'southern right whale Valdés'],
  },
};

const NOMBRES = { verano: 'Verano', otono: 'Otoño', invierno: 'Invierno', primavera: 'Primavera' };
const LIBRE = /^(cc[- ]by(-sa)?[- \d.]*|cc0|public domain|pd[- \w]*)$/i;

const sinHtml = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function buscar(q) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  u.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${q} filetype:bitmap`,
    gsrlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '480',
  });
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons respondió ${r.status} para «${q}»`);
  const j = await r.json();
  return (j.query?.pages ?? []).flatMap((p) => {
    const i = p.imageinfo?.[0];
    if (!i) return [];
    const lic = sinHtml(i.extmetadata?.LicenseShortName?.value);
    const ok = /jpeg|png|webp/.test(i.mime) && i.width >= 1600 && i.width > i.height * 1.1 && LIBRE.test(lic);
    if (!ok) return [];
    return [{
      archivo: p.title.replace(/^File:/, ''),
      miniatura: i.thumburl,
      pagina: i.descriptionurl,
      autor: sinHtml(i.extmetadata?.Artist?.value) || 'Autor desconocido',
      licencia: lic,
      fecha: sinHtml(i.extmetadata?.DateTimeOriginal?.value).slice(0, 10),
      tamano: `${i.width}×${i.height}`,
    }];
  });
}

const actual = JSON.parse(await readFile('src/data/fotos-estacion.json', 'utf8'));
const secciones = [];
for (const [destino, estaciones] of Object.entries(BUSQUEDAS)) {
  for (const [estacion, consultas] of Object.entries(estaciones)) {
    const vistos = new Map();
    for (const q of consultas) {
      try {
        for (const c of await buscar(q)) if (!vistos.has(c.archivo)) vistos.set(c.archivo, c);
      } catch (e) {
        console.warn(`  ✗ ${e.message}`);
      }
    }
    const lista = [...vistos.values()].slice(0, 18);
    console.log(`  ${destino} / ${estacion}: ${lista.length} candidatas`);
    secciones.push({ destino, estacion, lista, elegida: actual[destino]?.[estacion] ?? null });
  }
}

const tarjetas = (s) =>
  s.lista.length
    ? s.lista
        .map(
          (c) => `<label class="cand${c.archivo === s.elegida ? ' sel' : ''}">
  <input type="radio" name="${esc(s.destino)}|${s.estacion}" value="${esc(c.archivo)}"${c.archivo === s.elegida ? ' checked' : ''}>
  <img src="${esc(c.miniatura)}" alt="" loading="lazy">
  <span class="t">${esc(c.archivo)}</span>
  <span class="m">${esc(c.autor)} · ${esc(c.licencia)}${c.fecha ? ` · ${esc(c.fecha)}` : ''} · ${c.tamano} · <a href="${esc(c.pagina)}" target="_blank" rel="noopener">ver</a></span>
</label>`,
        )
        .join('\n')
    : '<p class="vacio">Sin candidatas con estas búsquedas. Probá agregar otras en scripts/buscar-fotos.mjs.</p>';

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fotos por estación</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 1rem max(16px, 3vw) 14rem; background: #f4f6f5; color: #15222b; }
  h1 { margin: 0 0 0.3rem; } h2 { margin: 2.5rem 0 0.6rem; font-size: 1.3rem; } .ayuda { color: #4b5b66; max-width: 70ch; }
  .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.8rem; }
  .cand { display: flex; flex-direction: column; gap: 0.3rem; background: #fff; border: 2px solid #d3dcdf; border-radius: 6px; padding: 0.5rem; cursor: pointer; }
  .cand input { position: absolute; opacity: 0; }
  .cand img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 3px; background: #e9eeee; }
  .cand .t { font-size: 0.8rem; font-weight: 600; word-break: break-word; } .cand .m { font-size: 0.75rem; color: #4b5b66; }
  .cand:has(input:checked) { border-color: #74acdf; box-shadow: 0 0 0 3px #74acdf55; }
  .vacio { color: #b24f27; }
  .salida { position: fixed; left: 0; right: 0; bottom: 0; background: #15222b; color: #fff; padding: 0.8rem max(16px, 3vw); }
  .salida textarea { width: 100%; height: 8rem; font: 12px/1.4 ui-monospace, monospace; }
  .salida button { margin-top: 0.4rem; padding: 0.5rem 1rem; font-weight: 600; }
</style></head><body>
<h1>Fotos por estación</h1>
<p class="ayuda">Elegí una foto por destino y estación (o ninguna). Abajo se arma el contenido para <code>src/data/fotos-estacion.json</code>: copialo, pegalo en ese archivo y corré <code>npm run fotos</code>. Mirá la fecha de cada foto: no siempre coincide con la estación que dice la búsqueda.</p>
${secciones.map((s) => `<h2>${esc(s.destino)} · ${NOMBRES[s.estacion]}</h2><div class="grilla">${tarjetas(s)}</div>`).join('\n')}
<div class="salida"><textarea id="json" readonly></textarea><button id="copiar" type="button">Copiar</button></div>
<script>
  const base = ${JSON.stringify(actual)};
  function armar() {
    const out = JSON.parse(JSON.stringify(base));
    document.querySelectorAll('input[type=radio]:checked').forEach((r) => {
      const [d, e] = r.name.split('|');
      out[d] = out[d] || {};
      out[d][e] = r.value;
    });
    document.getElementById('json').value = JSON.stringify(out, null, 2);
  }
  document.addEventListener('change', armar);
  document.getElementById('copiar').addEventListener('click', async () => {
    const t = document.getElementById('json');
    try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand('copy'); }
  });
  armar();
</script>
</body></html>`;

await writeFile('fotos-candidatas.html', html);
console.log('\nListo: abrí fotos-candidatas.html en el navegador.');
