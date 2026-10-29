import datos from '../data/temporada.json';
import type { Destino } from '../data/destinos';

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export type Nivel = 'alta' | 'media' | 'baja';

export interface Temporada {
  /** viajeros hospedados por mes (promedio de los años disponibles) */
  meses: (number | null)[];
  max: number;
  /** cada mes relativo al pico de ese mismo destino, de 0 a 1 */
  relativo: (number | null)[];
  nivel: (Nivel | null)[];
  /** meses con al menos el 80 % del pico (hasta 3) y los 3 meses con menos viajeros */
  picos: number[];
  calmos: number[];
  anios: string[];
  /** suma de los meses con dato */
  totalAnual: number;
  mesesConDato: number;
  /** meses que INDEC marca con coeficiente de variación mayor al 20 % */
  inciertos: number[];
}

interface Localidad {
  viajeros: Record<string, (number | null)[]>;
  inciertos: Record<string, number[]>;
}
const localidades = (datos as unknown as { localidades: Record<string, Localidad> }).localidades;

export const fuente = (datos as { fuente: string }).fuente;
export const aniosDatos = (datos as { anios: string[] }).anios;

export function temporada(d: Destino): Temporada | null {
  if (!d.localidadEOH) return null;
  const loc = localidades[d.localidadEOH];
  if (!loc) return null;
  const serie = loc.viajeros;
  const anios = Object.keys(serie).sort();
  if (!anios.length) return null;

  const meses = MESES.map((_, i) => {
    const valores = anios.map((a) => serie[a][i]).filter((v): v is number => typeof v === 'number');
    if (!valores.length) return null;
    return Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
  });
  const validos = meses.filter((v): v is number => v !== null);
  if (validos.length < 6) return null;

  const max = Math.max(...validos);
  const relativo = meses.map((v) => (v === null ? null : v / max));
  const orden = meses
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null)
    .sort((a, b) => b.v - a.v);
  // Niveles relativos al mes más lleno del mismo destino: así un lugar parejo
  // no aparece con "temporada alta" en meses que apenas se diferencian del resto.
  const nivel: (Nivel | null)[] = relativo.map((r) =>
    r === null ? null : r >= 0.8 ? 'alta' : r <= 0.55 ? 'baja' : 'media',
  );
  const picos = orden.filter((x) => x.v >= max * 0.8).slice(0, 3).map((x) => x.i).sort((a, b) => a - b);

  return {
    meses,
    max,
    relativo,
    nivel,
    picos,
    calmos: orden.slice(-3).map((x) => x.i).sort((a, b) => a - b),
    anios,
    totalAnual: validos.reduce((s, v) => s + v, 0),
    mesesConDato: validos.length,
    inciertos: [...new Set(Object.values(loc.inciertos).flat())].sort((a, b) => a - b),
  };
}

/** "enero, febrero y julio" */
export function listaMeses(indices: number[]): string {
  const n = indices.map((i) => MESES_LARGOS[i]);
  if (n.length <= 1) return n.join('');
  return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

export const numero = (v: number) => v.toLocaleString('es-AR');
