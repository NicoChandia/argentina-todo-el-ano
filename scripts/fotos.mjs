// Baja las fotos de Wikimedia Commons que usa el sitio y guarda autor y licencia.
//   npm run fotos
// Lee los nombres de archivo de src/data/destinos.json, lugares.json y la portada,
// pide a la API de Commons la URL de cada uno y sus metadatos, los baja una vez en alta
// resolución, genera WebP de 640, 1280 y 1920 px en public/fotos/ y escribe src/data/creditos.json.
// Si un nombre no existe en Commons, lo avisa y sigue con el resto.
// Solo acepta licencias que permiten uso comercial y modificación (CC BY, CC BY-SA, CC0 o
// dominio público). Una foto con otra licencia (por ejemplo "no comercial") NO se baja:
// el script la lista al final para que la cambies por otra.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const ANCHO = 1920;
const ANCHOS = [640, 1280, 1920];
const UA = 'ArgentinaTodoElAno/0.1 (https://github.com/NicoChandia; sitio de datos abiertos)';
const EXTRA = ['Perito Moreno Glacier South.jpg'];

const destinos = JSON.parse(await readFile('src/data/destinos.json', 'utf8'));
const porEstacion = JSON.parse(await readFile('src/data/fotos-estacion.json', 'utf8'));
const portada = JSON.parse(await readFile('src/data/portada.json', 'utf8'));
const lugares = JSON.parse(await readFile('src/data/lugares.json', 'utf8'));
const externas = JSON.parse(await readFile('src/data/fotos-externas.json', 'utf8'));
const todos = [
  ...new Set([
    ...EXTRA,
    ...destinos.flatMap((d) => d.fotos),
    ...Object.values(porEstacion).flatMap((v) => (typeof v === 'object' ? Object.values(v) : [])),
    ...portada.map((p) => p.foto),
    ...lugares.map((l) => l.foto).filter(Boolean),
  ]),
];
// Las de Wikimedia Commons se consultan a su API; las "apn:" se bajan directo de argentina.gob.ar.
const archivos = todos.filter((a) => !a.startsWith('apn:'));
const deApn = todos.filter((a) => a.startsWith('apn:'));

const slug = (s) =>
  s
    .replace(/\.[a-z]+$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Windows no acepta rutas de más de 260 caracteres, y la carpeta del proyecto ya es larga:
// los nombres muy largos se recortan y llevan un código corto para no repetirse.
const nombreArchivo = (s) => {
  const b = slug(s);
  if (b.length <= 60) return b;
  const h = createHash('sha1').update(s).digest('hex').slice(0, 6);
  return `${b.slice(0, 50).replace(/-$/, '')}-${h}`;
};

const sinHtml = (s = '') =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

async function consultar(lote) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  u.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(ANCHO),
    titles: lote.map((a) => `File:${a}`).join('|'),
  });
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons respondió ${r.status}`);
  return r.json();
}

const previos = existsSync('src/data/creditos.json')
  ? JSON.parse(await readFile('src/data/creditos.json', 'utf8'))
  : {};
const creditos = { ...previos };
await mkdir('public/fotos', { recursive: true });

const faltan = [];
for (const original of deApn) {
  const base = `public/fotos/${nombreArchivo(original.replace(/^apn:/, 'apn-'))}`;
  const variantes = Object.fromEntries(ANCHOS.map((a) => [a, `${base}-${a}.webp`]));
  if (!ANCHOS.every((a) => existsSync(variantes[a]))) {
    const img = await fetch('https://www.argentina.gob.ar/sites/default/files/' + original.slice(4), { headers: { 'User-Agent': UA } });
    if (!img.ok) {
      console.warn(`  ✗ no se pudo bajar ${original} (${img.status})`);
      continue;
    }
    const buf = Buffer.from(await img.arrayBuffer());
    try {
      for (const a of ANCHOS) {
        await sharp(buf).rotate().resize({ width: a, withoutEnlargement: true }).webp({ quality: a <= 640 ? 72 : 78 }).toFile(variantes[a]);
      }
    } catch (e) {
      console.warn(`  ✗ no se pudo guardar ${original}: ${e.message}`);
      continue;
    }
    console.log(`  ✓ ${original}`);
  }
  creditos[original] = {
    local: '/' + variantes[1280].replace(/^public\//, ''),
    variantes: Object.fromEntries(ANCHOS.map((a) => [a, '/' + variantes[a].replace(/^public\//, '')])),
    autor: 'Administración de Parques Nacionales',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://creativecommons.org/licenses/by/4.0/deed.es',
    pagina: externas[original]?.pagina ?? 'https://www.argentina.gob.ar/parquesnacionales',
  };
}
const noLibres = [];
const LIBRE = /^(cc[- ]by(-sa)?[- \d.]*|cc0[- \d.]*|public domain|pd[- \w.]*)$/i;
for (let i = 0; i < archivos.length; i += 40) {
  const lote = archivos.slice(i, i + 40);
  const res = await consultar(lote);
  const normal = new Map((res.query.normalized ?? []).map((n) => [n.to, n.from]));

  for (const p of res.query.pages) {
    const original = (normal.get(p.title) ?? p.title).replace(/^File:/, '');
    if (p.missing || !p.imageinfo) {
      faltan.push(original);
      continue;
    }
    const info = p.imageinfo[0];
    const meta = info.extmetadata ?? {};
    const licencia = sinHtml(meta.LicenseShortName?.value);
    if (!LIBRE.test(licencia)) {
      noLibres.push(`${original} (${licencia || 'sin licencia indicada'})`);
      delete creditos[original];
      continue;
    }
    const base = `public/fotos/${nombreArchivo(original)}`;
    const variantes = Object.fromEntries(ANCHOS.map((a) => [a, `${base}-${a}.webp`]));

    if (!ANCHOS.every((a) => existsSync(variantes[a]))) {
      const img = await fetch(info.thumburl ?? info.url, { headers: { 'User-Agent': UA } });
      if (!img.ok) {
        console.warn(`  ✗ no se pudo bajar ${original} (${img.status})`);
        continue;
      }
      const buf = Buffer.from(await img.arrayBuffer());
      try {
        for (const a of ANCHOS) {
          await sharp(buf).rotate().resize({ width: a, withoutEnlargement: true }).webp({ quality: a <= 640 ? 72 : 78 }).toFile(variantes[a]);
        }
      } catch (e) {
        // Una foto con problemas no frena al resto: se avisa y se sigue.
        console.warn(`  ✗ no se pudo guardar ${original}: ${e.message}`);
        continue;
      }
      console.log(`  ✓ ${original}`);
    } else {
      console.log(`  · ${original} (ya estaba)`);
    }

    creditos[original] = {
      local: '/' + variantes[1280].replace(/^public\//, ''),
      variantes: Object.fromEntries(ANCHOS.map((a) => [a, '/' + variantes[a].replace(/^public\//, '')])),
      autor: sinHtml(meta.Artist?.value) || 'Autor desconocido',
      licencia,
      licenciaUrl: meta.LicenseUrl?.value,
      pagina: info.descriptionurl,
    };
  }
}

await writeFile('src/data/creditos.json', JSON.stringify(creditos, null, 2) + '\n');
console.log(`\nListo: ${Object.keys(creditos).length} fotos con crédito en src/data/creditos.json`);
if (noLibres.length) {
  console.log('\nEstas fotos no tienen una licencia libre para uso comercial y NO se bajaron. Cambialas por otras:');
  noLibres.forEach((a) => console.log(`  - ${a}`));
  process.exitCode = 1;
}
if (faltan.length) {
  console.log('\nEstos nombres no existen en Commons; buscá otro y cambialo en destinos.json:');
  faltan.forEach((a) => console.log(`  - ${a}`));
}
