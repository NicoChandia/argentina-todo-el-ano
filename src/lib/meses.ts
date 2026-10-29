// "Qué pasa cada mes" y "Antes de ir": convierte los datos (clima del SMN, viajeros de INDEC
// y eventos verificados) en respuestas para quien planea un viaje. Las reglas son simples y
// a la vista, para que nada parezca inventado.
import clima from '../data/clima.json';
import eventos from '../data/eventos.json';
import type { Destino } from '../data/destinos';
import { temporada } from './temporada';
import { listaMeses, mesesLargos, type Lang } from '../i18n';

type T = Record<Lang, string>;
interface Estacion { nombre: string; periodo: string; max: number[]; min: number[] | null; lluvia: number[] }
interface Evento { mes: number | number[]; titulo: T; texto: T }

export interface Mes {
  i: number;
  titulo: string;
  evento?: string;
  texto: string;
  clima?: string;
  gente: 'alta' | 'media' | 'baja' | null;
  genteTexto?: string;
  llevar: string[];
  icono: 'sol' | 'nube' | 'lluvia' | null;
  max?: number;
}

const X = {
  es: {
    estacion: ['Verano', 'Verano', 'Otoño', 'Otoño', 'Otoño', 'Invierno', 'Invierno', 'Invierno', 'Primavera', 'Primavera', 'Primavera', 'Verano'],
    vacVerano: 'Vacaciones de verano', vacInvierno: 'Vacaciones de invierno', alta: 'Temporada alta', lluvias: 'Época de lluvias',
    frio: 'Pleno invierno', calor: 'Calor', tranquilo: 'Tranquilo',
    dia: (t: string, v: number) => `días ${t} (${v}°)`, noche: (t: string, v: number) => `noches ${t} (${v}°)`,
    tDia: ['calurosos', 'templados', 'frescos', 'fríos'], tNoche: ['templadas', 'frescas', 'frías', 'muy frías'],
    ll: ['llueve mucho', 'llueve seguido', 'llueve poco', 'casi no llueve'],
    gente: { alta: 'Mucha gente: reservá con tiempo.', media: 'Movimiento normal.', baja: 'Pocos viajeros: más tranquilo.' },
    llevar: { abrigo: 'abrigo de invierno', abriguito: 'un abrigo para la noche', liviana: 'ropa liviana', paraguas: 'paraguas o impermeable', sol: 'protector solar' },
    mejor: (m: string) => `${m}: buen clima y menos gente.`,
    resumenClima: (v: string, i: string, ll: string) => `Veranos ${v}; inviernos ${i}. ${ll}`,
    verano: (t: string, v: number) => `${t} (${v}° de máxima en enero)`,
    invierno: (t: string, v: number) => `con noches ${t} (${v}° de mínima en julio)`,
    llueveMas: (m: string, r: boolean) => `Llueve más ${r ? 'de' : 'en'} ${m}.`,
    pocaLluvia: 'Llueve poco en todo el año.',
    llevarIv: (m: string) => `abrigo de ${m}`,
    llevarLl: (m: string) => `paraguas de ${m}`,
    llevarSol: 'protector solar todo el año',
  },
  pt: {
    estacion: ['Verão', 'Verão', 'Outono', 'Outono', 'Outono', 'Inverno', 'Inverno', 'Inverno', 'Primavera', 'Primavera', 'Primavera', 'Verão'],
    vacVerano: 'Férias de verão', vacInvierno: 'Férias de inverno', alta: 'Alta temporada', lluvias: 'Época de chuvas',
    frio: 'Pleno inverno', calor: 'Calor', tranquilo: 'Tranquilo',
    dia: (t: string, v: number) => `dias ${t} (${v}°)`, noche: (t: string, v: number) => `noites ${t} (${v}°)`,
    tDia: ['quentes', 'amenos', 'frescos', 'frios'], tNoche: ['amenas', 'frescas', 'frias', 'muito frias'],
    ll: ['chove muito', 'chove com frequência', 'chove pouco', 'quase não chove'],
    gente: { alta: 'Muita gente: reserve com antecedência.', media: 'Movimento normal.', baja: 'Poucos viajantes: mais tranquilo.' },
    llevar: { abrigo: 'agasalho de inverno', abriguito: 'um casaco para a noite', liviana: 'roupa leve', paraguas: 'guarda-chuva ou capa de chuva', sol: 'protetor solar' },
    mejor: (m: string) => `${m}: bom clima e menos gente.`,
    resumenClima: (v: string, i: string, ll: string) => `Verões ${v}; invernos ${i}. ${ll}`,
    verano: (t: string, v: number) => `${t} (${v}° de máxima em janeiro)`,
    invierno: (t: string, v: number) => `com noites ${t} (${v}° de mínima em julho)`,
    llueveMas: (m: string, r: boolean) => `Chove mais ${r ? 'de' : 'em'} ${m}.`,
    pocaLluvia: 'Chove pouco o ano todo.',
    llevarIv: (m: string) => `agasalho de ${m}`,
    llevarLl: (m: string) => `guarda-chuva de ${m}`,
    llevarSol: 'protetor solar o ano todo',
  },
  en: {
    estacion: ['Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter', 'Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer'],
    vacVerano: 'Summer holidays', vacInvierno: 'Winter holidays', alta: 'High season', lluvias: 'Rainy season',
    frio: 'Deep winter', calor: 'Hot', tranquilo: 'Quiet',
    dia: (t: string, v: number) => `${t} days (${v}°)`, noche: (t: string, v: number) => `${t} nights (${v}°)`,
    tDia: ['hot', 'mild', 'cool', 'cold'], tNoche: ['mild', 'cool', 'cold', 'very cold'],
    ll: ['very rainy', 'frequent rain', 'little rain', 'almost no rain'],
    gente: { alta: 'Busy: book ahead.', media: 'Normal crowds.', baja: 'Few travelers: quieter.' },
    llevar: { abrigo: 'a winter coat', abriguito: 'a jacket for the evening', liviana: 'light clothes', paraguas: 'an umbrella or rain jacket', sol: 'sunscreen' },
    mejor: (m: string) => `${m}: good weather and fewer people.`,
    resumenClima: (v: string, i: string, ll: string) => `Summers are ${v}; winters are ${i}. ${ll}`,
    verano: (t: string, v: number) => `${t} (highs of ${v}° in January)`,
    invierno: (t: string, v: number) => `${t} at night (lows of ${v}° in July)`,
    llueveMas: (m: string, r: boolean) => `Rainiest ${r ? 'from' : 'in'} ${m}.`,
    pocaLluvia: 'Little rain all year.',
    llevarIv: (m: string) => `a warm coat from ${m}`,
    llevarLl: (m: string) => `an umbrella from ${m}`,
    llevarSol: 'sunscreen all year',
  },
} as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nivelDia = (v: number) => (v >= 28 ? 0 : v >= 20 ? 1 : v >= 12 ? 2 : 3);
const nivelNoche = (v: number) => (v >= 15 ? 0 : v >= 9 ? 1 : v >= 4 ? 2 : 3);
const nivelLluvia = (v: number) => (v >= 150 ? 0 : v >= 60 ? 1 : v >= 20 ? 2 : 3);

export function estacionDe(id: string): Estacion | null {
  const ref = (clima.destinos as Record<string, { estacion: string }>)[id];
  return ref ? ((clima.estaciones as Record<string, Estacion>)[ref.estacion] ?? null) : null;
}

/** Los 12 meses de un destino, o null si no hay nada que contar (sin clima, sin INDEC y sin eventos). */
export function meses(d: Destino, lang: Lang): Mes[] | null {
  const x = X[lang];
  const est = estacionDe(d.id);
  const t = temporada(d);
  const evs = ((eventos as Record<string, Evento[]>)[d.id] ?? []);
  if (!est && !t && !evs.length) return null;

  return Array.from({ length: 12 }, (_, i): Mes => {
    // Primero un evento puntual del mes; si no hay, una temporada (ballenas, nieve…).
    const ev = evs.find((e) => e.mes === i + 1) ?? evs.find((e) => Array.isArray(e.mes) && e.mes.includes(i + 1));
    const max = est ? Math.round(est.max[i]) : undefined;
    const min = est?.min ? Math.round(est.min[i]) : undefined;
    const ll = est ? Math.round(est.lluvia[i]) : undefined;
    const gente = t?.nivel[i] ?? null;

    let titulo: string = x.estacion[i];
    if (gente === 'alta' && (i <= 1)) titulo = x.vacVerano;
    else if (gente === 'alta' && i === 6) titulo = x.vacInvierno;
    else if (gente === 'alta') titulo = x.alta;
    else if (ll !== undefined && ll >= 150) titulo = x.lluvias;
    else if (max !== undefined && max <= 8) titulo = x.frio;
    else if (max !== undefined && max >= 31) titulo = x.calor;
    else if (gente === 'baja') titulo = x.tranquilo;

    const partes: string[] = [];
    if (max !== undefined) partes.push(x.dia(x.tDia[nivelDia(max)], max));
    if (min !== undefined) partes.push(x.noche(x.tNoche[nivelNoche(min)], min));
    const conj = lang === 'pt' ? ' e ' : lang === 'en' ? ', ' : ' y ';
    const climaTxt = est ? cap(partes.join(conj)) + (ll !== undefined ? `; ${x.ll[nivelLluvia(ll)]}.` : '.') : undefined;

    const llevar: string[] = [];
    if (min !== undefined && min <= 3) llevar.push(x.llevar.abrigo);
    else if (min !== undefined && min <= 12) llevar.push(x.llevar.abriguito);
    else if (max !== undefined && max <= 12) llevar.push(x.llevar.abrigo);
    if (max !== undefined && max >= 28) llevar.push(x.llevar.liviana);
    if (ll !== undefined && ll >= 60) llevar.push(x.llevar.paraguas);
    if (max !== undefined && max >= 18) llevar.push(x.llevar.sol);

    return {
      i,
      titulo: ev ? ev.titulo[lang] : titulo,
      evento: ev?.texto[lang],
      texto: ev ? ev.texto[lang] : '',
      clima: climaTxt,
      gente,
      genteTexto: gente ? x.gente[gente] : undefined,
      llevar,
      icono: ll === undefined ? null : ll >= 100 ? 'lluvia' : ll >= 40 ? 'nube' : 'sol',
      max,
    };
  });
}

export interface AntesDeIr { mejor?: string; clima?: string; llevar?: string }

/** Resumen corto para el costado de la ficha. */
/** Destinos de playa: su mejor época es la del calor, no la de menos gente en invierno. */
const PLAYA = new Set(['mar-del-plata', 'pinamar', 'villa-gesell', 'miramar', 'las-grutas']);

export function antesDeIr(d: Destino, lang: Lang): AntesDeIr | null {
  const x = X[lang];
  const est = estacionDe(d.id);
  const t = temporada(d);
  const L = mesesLargos(lang);
  const out: AntesDeIr = {};

  // Mejor época: meses con clima cómodo, poca lluvia y sin temporada alta; los de menos viajeros primero.
  if (est) {
    // En la playa, "buen clima" es calor de playa; en el resto, días agradables (18° a 30°).
    // Si ningún mes entra con ese rango, se acepta desde 14°.
    const playa = PLAYA.has(d.id);
    const elegir = (min: number) =>
      Array.from({ length: 12 }, (_, i) => i).filter((i) => {
        const mx = est.max[i], ll = est.lluvia[i];
        const ok = mx >= min && mx <= (playa ? 34 : 30) && ll < 100;
        return ok && (!t || t.nivel[i] !== 'alta');
      });
    let cand = elegir(playa ? 22 : 18);
    if (!cand.length && !playa) cand = elegir(14);
    // Donde la razón del viaje es una temporada (ballenas, pingüinos), se elige dentro de ella.
    const temporadas = ((eventos as Record<string, Evento[]>)[d.id] ?? []).filter((e) => Array.isArray(e.mes));
    if (temporadas.length) {
      const dentro = new Set(temporadas.flatMap((e) => (e.mes as number[]).map((m) => m - 1)));
      const ambas = cand.filter((i) => dentro.has(i));
      if (ambas.length) cand = ambas;
    }
    const orden = t ? [...cand].sort((a, b) => (t.meses[a] ?? 1e12) - (t.meses[b] ?? 1e12)) : cand;
    const elegidos = orden.slice(0, 3).sort((a, b) => a - b);
    if (elegidos.length) out.mejor = x.mejor(cap(listaMeses(elegidos, lang)));

    const ver = Math.round(est.max[0]);
    const inv = est.min ? Math.round(est.min[6]) : null;
    const lluviosos = Array.from({ length: 12 }, (_, i) => i).filter((i) => est.lluvia[i] >= 100);
    const llTxt = lluviosos.length ? x.llueveMas(rango(lluviosos, L, lang), lluviosos.length > 1) : x.pocaLluvia;
    out.clima = x.resumenClima(
      x.verano(x.tDia[nivelDia(ver)], ver),
      inv !== null ? x.invierno(x.tNoche[nivelNoche(inv)], inv) : x.tDia[nivelDia(Math.round(est.max[6]))],
      llTxt,
    );

    const frios = Array.from({ length: 12 }, (_, i) => i).filter((i) => (est.min ? est.min[i] <= 5 : est.max[i] <= 12));
    const ll: string[] = [];
    if (frios.length) ll.push(frios.length >= 11 ? x.llevar.abrigo : x.llevarIv(rango(frios, L, lang)));
    if (lluviosos.length) ll.push(x.llevarLl(rango(lluviosos, L, lang)));
    ll.push(x.llevarSol);
    out.llevar = cap(ll.join('; ')) + '.';
  }
  return out.mejor || out.clima ? out : null;
}

/** "de mayo a septiembre" a partir de una lista de meses (circular). */
function rango(ms: number[], L: string[], lang: Lang): string {
  const set = new Set(ms);
  // buscar el inicio de la racha más larga, contando que diciembre sigue a enero
  let inicio = ms[0];
  for (const m of ms) if (!set.has((m + 11) % 12)) { inicio = m; break; }
  let fin = inicio;
  while (set.has((fin + 1) % 12) && (fin + 1) % 12 !== inicio) fin = (fin + 1) % 12;
  if (inicio === fin) return L[inicio];
  const a = lang === 'en' ? 'to' : 'a';
  return `${L[inicio]} ${a} ${L[fin]}`;
}
