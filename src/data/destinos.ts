// Los destinos viven en destinos.json (ordenados de norte a sur) para que los scripts
// de fotos y de datos los puedan leer sin TypeScript.
// - `fotos`: nombres exactos de archivos de Wikimedia Commons, sin el prefijo "File:".
// - `localidadEOH`: cómo figura la localidad en los cuadros de la Encuesta de Ocupación
//   Hotelera (INDEC). null = la localidad no está medida, y la página lo dice.
import lista from './destinos.json';
import type { Lang } from '../i18n';

type Texto<T = string> = Record<Lang, T>;

export type Region = 'Norte' | 'Litoral' | 'Cuyo' | 'Centro' | 'Buenos Aires' | 'Patagonia';

export interface Destino {
  id: string;
  nombre: Texto;
  provincia: string;
  region: Region;
  latitud: string;
  lema: Texto;
  texto: Texto;
  imperdibles: Texto<string[]>;
  fotos: string[];
  localidadEOH: string | null;
  /** true: aparece en la portada y en el calendario general. */
  destacado?: boolean;
  /** Cómo llegar, en una o dos frases. */
  llegar?: Texto;
  /** Cuándo conviene ir, para lugares que INDEC no mide (sale de fuentes oficiales). */
  cuando?: Texto;
}

/** Los destinos de la portada y el calendario; el resto vive en su provincia. */
export const destacados = () => destinos.filter((d) => d.destacado);

export const destinos = lista as unknown as Destino[];
