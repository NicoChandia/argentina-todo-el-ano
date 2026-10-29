// Avisos actuales para viajeros, en vivo: alertas del Servicio Meteorológico Nacional (SMN),
// crecidas de ríos junto a destinos (Instituto Nacional del Agua, INA), volcanes en alerta
// (Observatorio Argentino de Vigilancia Volcánica, OAVV-SEGEMAR) y eventos del Sistema Global
// de Alerta y Coordinación de Desastres (GDACS, ONU y Comisión Europea) en la Argentina. Corre como función de Vercel y la respuesta queda en caché
// 30 minutos, así que las fuentes se consultan pocas veces aunque haya muchas visitas.
//
// La página nunca inventa ni interpreta un aviso: muestra lo que dice la fuente, con su
// link oficial y la hora. Si una fuente no responde, se informa y se sigue con la otra.

import type { APIRoute } from 'astro';
import { XMLParser } from 'fast-xml-parser';
import { geoContains } from 'd3-geo';
import provinciasRaw from '../../data/provincias.geojson?raw';
import info from '../../data/provincias-info.json';
import estacionesINA from '../../data/ina-estaciones.json';

export const prerender = false;

// Canales del Sistema de Alerta Temprana del SMN (https://www.smn.gob.ar/rss): el general
// (alertas, temperaturas extremas, advertencias y avisos a muy corto plazo) y, por las dudas,
// los canales propios de temperaturas extremas y de avisos a muy corto plazo.
const SMN_CANALES = [
  'https://ssl.smn.gob.ar/CAP/AR.php',
  'https://ssl.smn.gob.ar/feeds/CAP/oladecalor/rss_ola_calor_nuevo.xml',
  'https://ssl.smn.gob.ar/feeds/CAP/avisocortoplazo/rss_acpCAP.xml',
];
const GDACS = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH';
const INA = 'https://alerta.ina.gob.ar/pub/datos/datos';
const OAVV = 'https://oavv.segemar.gob.ar';
const UA = 'ArgentinaTodoElAno/0.1 (+https://argentina-todo-el-ano.vercel.app)';

export interface Aviso {
  fuente: 'SMN' | 'GDACS' | 'INA' | 'OAVV';
  /** Tipo del evento tal como lo nombra la fuente (por ejemplo "Tormentas", "Flood"). */
  tipo: string;
  /** amarillo | naranja | rojo | verde, normalizado desde la fuente. */
  nivel: 'verde' | 'amarillo' | 'naranja' | 'rojo';
  titulo: string;
  zonas: string;
  provincias: string[];
  desde?: string;
  hasta?: string;
  link: string;
}

const NOMBRES = info.map((p) => p.nombre);
const cortos: Record<string, string> = {
  'Ciudad Autónoma de Buenos Aires': 'Ciudad de Buenos Aires',
  'Tierra del Fuego, Antártida e Islas del Atlántico Sur': 'Tierra del Fuego',
};
const geo = JSON.parse(provinciasRaw);

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Provincias nombradas en un texto. "Buenos Aires" solo cuenta si no es la Ciudad. */
function provinciasEnTexto(texto: string): string[] {
  const t = sinTildes(texto);
  return NOMBRES.filter((n) => {
    const k = sinTildes(n);
    if (n === 'Buenos Aires') return /provincia de buenos aires|buenos aires\b/.test(t.replace(/ciudad (autonoma )?de buenos aires/g, ''));
    return t.includes(k);
  });
}

function provinciaDePunto(lon: number, lat: number): string | null {
  const f = geo.features.find((g: any) => geoContains(g, [lon, lat]));
  return f ? (cortos[f.properties.nombre] ?? f.properties.nombre) : null;
}

async function traer(url: string, tipo: 'texto' | 'json') {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: tipo === 'json' ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${new URL(url).host} respondió ${r.status}`);
  return tipo === 'json' ? r.json() : r.text();
}

const lista = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const xml = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, textNodeName: '_t' });
// El SMN escribe los acentos como entidades (&#xE1; = á): se convierten a texto normal.
const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodificar = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);
const texto = (v: any): string => decodificar((v == null ? '' : typeof v === 'object' ? String(v._t ?? '') : String(v)).trim());

function nivelSMN(severidad: string, titulo: string): Aviso['nivel'] {
  const s = sinTildes(`${severidad} ${titulo}`);
  if (/rojo|extreme/.test(s)) return 'rojo';
  if (/naranja|severe/.test(s)) return 'naranja';
  return 'amarillo';
}

/** Detalles CAP que no se pudieron leer (se ven con /api/avisos.json?diagnostico). */
const fallas: string[] = [];

/** Alertas del SMN en formato CAP: un índice con un link por alerta. */
async function avisosSMN(): Promise<Aviso[]> {
  const canales = await Promise.allSettled(SMN_CANALES.map((u) => traer(u, 'texto')));
  if (canales[0].status === 'rejected') throw canales[0].reason;
  // Un mismo aviso puede aparecer en más de un canal: se toma una vez por link. Los ítems
  // sin link a un archivo CAP (por ejemplo "No se han emitido avisos") se descartan.
  const vistos = new Set<string>();
  const items = canales
    .flatMap((c) => (c.status === 'fulfilled' ? lista((xml.parse(c.value) as any)?.rss?.channel?.item ?? (xml.parse(c.value) as any)?.feed?.entry) : []))
    .filter((it: any) => {
      const l = texto(it.link?.['@_href'] ?? it.link);
      if (!/\.xml($|\?)/i.test(l) || vistos.has(l)) return false;
      vistos.add(l);
      return true;
    });
  const ahora = Date.now();
  const avisos = await Promise.all(
    items.slice(0, 60).map(async (it: any): Promise<Aviso | null> => {
      const link = texto(it.link?.['@_href'] ?? it.link);
      let titulo = texto(it.title);
      let zonas = texto(it.description ?? it.summary);
      let severidad = '';
      let evento = '';
      let desde: string | undefined;
      let hasta: string | undefined;
      const provPoligono = new Set<string>();
      // El detalle CAP trae las zonas y la vigencia exactas; si no responde, alcanza con el índice.
      if (link) {
        try {
          const cap = xml.parse(await traer(link, 'texto'))?.alert;
          const infoCap = lista(cap?.info).find((i: any) => /^es/i.test(texto(i.language) || 'es')) ?? lista(cap?.info)[0];
          if (infoCap) {
            evento = texto(infoCap.event);
            severidad = texto(infoCap.severity);
            titulo = texto(infoCap.headline) || titulo;
            desde = texto(infoCap.onset ?? infoCap.effective) || undefined;
            hasta = texto(infoCap.expires) || undefined;
            const areas = lista(infoCap.area);
            // El SMN pone en areaDesc la descripción del fenómeno y marca la zona con un polígono
            // ("lat,lon lat,lon ..."): las provincias salen de dónde caen sus puntos.
            zonas = texto(infoCap.description) || areas.map((a: any) => texto(a.areaDesc)).filter(Boolean).join(' · ') || zonas;
            for (const a of areas) {
              for (const pol of lista(a.polygon)) {
                const puntos = texto(pol)
                  .split(/\s+/)
                  .map((par) => par.split(',').map(Number))
                  .filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));
                if (!puntos.length) continue;
                const centro = [puntos.reduce((m, p) => m + p[0], 0) / puntos.length, puntos.reduce((m, p) => m + p[1], 0) / puntos.length];
                for (const [la, lo] of [...puntos, centro]) {
                  const pr = provinciaDePunto(lo, la);
                  if (pr) provPoligono.add(pr);
                }
              }
            }
          }
        } catch (e) {
          /* se usa lo del índice */
          fallas.push(`${link}: ${(e as Error).message}`);
        }
      }
      if (hasta && Date.parse(hasta) < ahora) return null;
      return {
        fuente: 'SMN',
        tipo: evento || titulo,
        nivel: nivelSMN(severidad, titulo),
        titulo,
        zonas: zonas.slice(0, 600),
        provincias: [...new Set([...provPoligono, ...provinciasEnTexto(titulo)])],
        desde,
        hasta,
        link: link || 'https://www.smn.gob.ar/alertas',
      };
    }),
  );
  return avisos.filter((a): a is Aviso => a !== null);
}

/** Eventos de GDACS de los últimos 30 días que tocan la Argentina. */
async function avisosGDACS(): Promise<Aviso[]> {
  const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const u = new URL(GDACS);
  u.search = new URLSearchParams({ eventlist: 'FL;DR;WF;EQ;VO;TC', fromDate: desde, alertlevel: 'Green;Orange;Red' }).toString();
  const j: any = await traer(u.toString(), 'json');
  return lista(j?.features)
    .filter((f: any) => {
      const p = f.properties ?? {};
      const enArgentina = /argentina/i.test(`${p.country ?? ''} ${p.affectedcountries?.map?.((c: any) => c.countryname).join(' ') ?? ''}`) || p.iso3 === 'ARG';
      return enArgentina && p.iscurrent !== 'false' && p.iscurrent !== false;
    })
    .map((f: any): Aviso => {
      const p = f.properties;
      const [lon, lat] = f.geometry?.type === 'Point' ? f.geometry.coordinates : [NaN, NaN];
      const prov = Number.isFinite(lon) ? provinciaDePunto(lon, lat) : null;
      const nivel = String(p.alertlevel).toLowerCase();
      return {
        fuente: 'GDACS',
        tipo: String(p.eventtype),
        nivel: nivel === 'red' ? 'rojo' : nivel === 'orange' ? 'naranja' : 'verde',
        titulo: String(p.name || p.description || p.htmldescription || '').trim(),
        zonas: String(p.description || ''),
        provincias: [...new Set([...(prov ? [prov] : []), ...provinciasEnTexto(`${p.name ?? ''} ${p.description ?? ''}`)])],
        desde: p.fromdate,
        hasta: p.todate,
        link: p.url?.report ?? `https://www.gdacs.org/report.aspx?eventtype=${p.eventtype}&eventid=${p.eventid}`,
      };
    });
}

/**
 * Ríos junto a destinos (estaciones del INA a menos de 30 km de uno): se avisa solo si la
 * última altura medida, de los últimos 3 días, llega al nivel de alerta (naranja) o de
 * evacuación (rojo) que fija el propio INA para esa estación.
 */
async function avisosINA(): Promise<Aviso[]> {
  const hoy = new Date();
  const inicio = new Date(hoy.getTime() - 4 * 86400000).toISOString().slice(0, 10);
  const fin = hoy.toISOString().slice(0, 10);
  const limite = hoy.getTime() - 3 * 86400000;
  const res = await Promise.allSettled(
    estacionesINA.map(async (e): Promise<Aviso | null> => {
      const j: any = await traer(`${INA}&timeStart=${inicio}&timeEnd=${fin}T23:59&siteCode=${e.id}&varId=2&format=json`, 'json');
      const ult = lista(j?.data)
        .filter((d: any) => Number.isFinite(Number(d.valor)) && d.timestart)
        .sort((a: any, b: any) => String(b.timestart).localeCompare(String(a.timestart)))[0];
      if (!ult || Date.parse(`${ult.timestart}-03:00`) < limite) return null;
      const valor = Number(ult.valor);
      if (valor < e.alerta) return null;
      const m = (n: number) => `${n.toFixed(2).replace('.', ',')} m`;
      return {
        fuente: 'INA',
        tipo: 'Crecida',
        nivel: valor >= e.evacuacion ? 'rojo' : 'naranja',
        titulo: `Río ${e.rio} en ${e.nombre}`,
        zonas: `Río ${e.rio} en ${e.nombre}: ${m(valor)} (alerta ${m(e.alerta)}, evacuación ${m(e.evacuacion)})`,
        provincias: [e.provincia],
        desde: `${ult.timestart}-03:00`,
        link: 'https://alerta.ina.gob.ar/pub/gui',
      };
    }),
  );
  if (res.every((r) => r.status === 'rejected')) throw (res[0] as PromiseRejectedResult).reason;
  return res.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
}

// Volcanes que vigila el OAVV y provincias donde un aviso puede cambiarle el viaje a alguien
// (por cercanía o por dónde suele caer la ceniza). Los que no están acá no se asignan.
const VOLCANES: [RegExp, string[]][] = [
  [/copahue|domuyo|tromen|lanin|llaima|quetrupill|villarrica|mocho/, ['Neuquén']],
  [/chillan|antuco|callaqui/, ['Neuquén', 'Mendoza']],
  [/maule|planchon|peteroa|descabezado|tupungat|maipo|san jose|overo|risco plateado/, ['Mendoza']],
  [/puyehue|caulle|osorno|calbuco|casablanca|antillanca|tronador/, ['Neuquén', 'Río Negro']],
  [/chaiten|michinmahuida|corcovado|melimoyu|yanteles/, ['Chubut']],
  [/hudson|lautaro/, ['Chubut', 'Santa Cruz']],
  [/lascar|lastarria|socompa|llullaillaco|ojos del salado|incahuasi|antofalla|galan/, ['Salta', 'Jujuy', 'Catamarca']],
];
// El OAVV publica el nivel como imagen: cada nivel es siempre el mismo archivo, así que se
// reconoce por su tamaño. Si aparece uno desconocido (naranja o rojo), se avisa como naranja.
const NIVEL_VOLCAN: Record<number, Aviso['nivel']> = { 22150: 'verde', 23897: 'amarillo' };

/** Volcanes en alerta según el OAVV. Los de Chile se avisan recién desde naranja. */
async function avisosOAVV(): Promise<Aviso[]> {
  const html: string = await traer(`${OAVV}/scripts/show_volcanes_alerta.php`, 'texto');
  const tarjetas = html.split('volcano-card').slice(1);
  const avisos = await Promise.all(
    tarjetas.map(async (t): Promise<Aviso | null> => {
      const nombre = decodificar(t.match(/class="volcano-name">[\s\S]*?>\s*([^<]+?)\s*</)?.[1] ?? '');
      const pais = decodificar(t.match(/class="volcano-country">[\s\S]*?>\s*([^<]+?)\s*</)?.[1] ?? '');
      const img = t.match(/show_alerta\.php\?id=(\d+)/)?.[1];
      if (!nombre || !img) return null;
      let nivel: Aviso['nivel'] = 'naranja';
      try {
        const r = await fetch(`${OAVV}/scripts/show_alerta.php?id=${img}&h=0`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
        nivel = NIVEL_VOLCAN[(await r.arrayBuffer()).byteLength] ?? 'naranja';
      } catch {
        /* sin imagen: queda como naranja, el link lleva al reporte oficial */
      }
      if (nivel === 'verde') return null;
      if (nivel === 'amarillo' && !/argentina/i.test(pais)) return null;
      const n = sinTildes(nombre);
      const provincias = VOLCANES.find(([re]) => re.test(n))?.[1] ?? [];
      const lindo = nombre
        .toLowerCase()
        .split(/\s+/)
        .map((w, i) => (i > 0 && /^(de|del|la|las|los|y)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ')
        .replace(/^Cv\./, 'Complejo volcánico');
      return {
        fuente: 'OAVV',
        tipo: 'Volcán',
        nivel,
        titulo: lindo,
        zonas: `${lindo}${pais ? ` (${pais})` : ''}`,
        provincias,
        link: `${OAVV}/scripts/show_reporte.php?id_volcan=${img}`,
      };
    }),
  );
  return avisos.filter((a): a is Aviso => a !== null);
}

export const GET: APIRoute = async ({ url }) => {
  fallas.length = 0;
  const [smn, gdacs, ina, oavv] = await Promise.allSettled([avisosSMN(), avisosGDACS(), avisosINA(), avisosOAVV()]);
  const estado = (r: PromiseSettledResult<unknown>, u: string) =>
    r.status === 'fulfilled' ? { ok: true, url: u } : { ok: false, error: String(r.reason?.message ?? r.reason) };
  const cuerpo = {
    actualizado: new Date().toISOString(),
    fuentes: {
      SMN: estado(smn, 'https://www.smn.gob.ar/alertas'),
      GDACS: estado(gdacs, 'https://www.gdacs.org/'),
      INA: estado(ina, 'https://alerta.ina.gob.ar/pub/gui'),
      OAVV: estado(oavv, OAVV),
    },
    ...(url.searchParams.has('diagnostico') ? { fallas } : {}),
    avisos: [smn, gdacs, ina, oavv].flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
  };
  return new Response(JSON.stringify(cuerpo), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 30 minutos en la caché de Vercel; si vence, se sirve la anterior mientras se renueva.
      'Cache-Control': 'public, max-age=300',
      'CDN-Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  });
};
