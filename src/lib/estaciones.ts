// Estaciones del hemisferio sur: verano (dic–feb), otoño (mar–may), invierno (jun–ago), primavera (sep–nov).
import textos from '../data/estaciones.json';
import fotosEstacion from '../data/fotos-estacion.json';
import { foto, type Foto } from './fotos';
import { tr, type Lang } from '../i18n';

export const ESTACIONES = ['verano', 'otono', 'invierno', 'primavera'] as const;
export type Estacion = (typeof ESTACIONES)[number];

/** Índice de mes (0 = enero) → estación del hemisferio sur. */
export function estacionDeMes(mes: number): Estacion {
  if (mes === 11 || mes <= 1) return 'verano';
  if (mes <= 4) return 'otono';
  if (mes <= 7) return 'invierno';
  return 'primavera';
}

type Textos = Record<string, Record<Estacion, Record<Lang, string>>>;
type Fotos = Record<string, Partial<Record<Estacion, string>>>;

const T = textos as Textos;
const F = fotosEstacion as unknown as Fotos;

export interface EstacionDestino {
  id: Estacion;
  texto: string;
  foto: Foto | null;
}

/** Las cuatro estaciones de un destino, o null si todavía no tiene textos por estación. */
export function estacionesDe(destinoId: string, lang: Lang): EstacionDestino[] | null {
  const t = T[destinoId];
  if (!t) return null;
  return ESTACIONES.map((id) => {
    const archivo = F[destinoId]?.[id];
    return { id, texto: tr(t[id], lang), foto: archivo ? foto(archivo, 1280) : null };
  });
}

/** Todos los archivos de fotos por estación, para que `npm run fotos` también los baje. */
export function archivosPorEstacion(): string[] {
  return Object.values(F).flatMap((porEstacion) =>
    typeof porEstacion === 'object' ? Object.values(porEstacion).filter((v): v is string => !!v) : [],
  );
}
