import creditos from '../data/creditos.json';
import externas from '../data/fotos-externas.json';

// creditos.json lo genera `npm run fotos`: baja cada foto a public/fotos/ en tres anchos
// (640, 1280 y 1920 px) y guarda autor y licencia. Mientras no exista la copia local,
// la foto se carga directo desde Wikimedia Commons, también en tres anchos.
// Con `srcset` y `sizes`, cada celular baja solo el tamaño que necesita.

export const ANCHOS = [640, 1280, 1920] as const;

interface Credito {
  local?: string;
  variantes?: Record<string, string>;
  autor?: string;
  licencia?: string;
  licenciaUrl?: string;
}

export interface Foto {
  src: string;
  srcset: string;
  archivo: string;
  pagina: string;
  autor?: string;
  licencia?: string;
  licenciaUrl?: string;
}

const tabla = creditos as Record<string, Credito>;

const enc = (archivo: string) => encodeURIComponent(archivo.replace(/ /g, '_'));
const commons = (archivo: string, ancho: number) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${enc(archivo)}?width=${ancho}`;

/** `ancho`: el tamaño que usa `src` como respaldo para navegadores sin srcset. */
// Fotos de argentina.gob.ar (Parques Nacionales), bajo licencia CC BY 4.0. Se nombran
// con el prefijo "apn:" seguido del nombre de archivo del sitio.
const APN = 'https://www.argentina.gob.ar/sites/default/files/';
const externasTabla = externas as Record<string, { pagina: string }>;

export function foto(archivo: string, ancho = 1280): Foto {
  const c = tabla[archivo] ?? {};
  if (archivo.startsWith('apn:')) {
    const v = c.variantes;
    const original = APN + archivo.slice(4);
    const cerca = ANCHOS.reduce((m, a) => (Math.abs(a - ancho) < Math.abs(m - ancho) ? a : m), ANCHOS[0]);
    return {
      archivo,
      src: v?.[cerca] ?? original,
      srcset: v ? ANCHOS.filter((a) => v[a]).map((a) => `${v[a]} ${a}w`).join(', ') : `${original} 1600w`,
      pagina: externasTabla[archivo]?.pagina ?? 'https://www.argentina.gob.ar/parquesnacionales',
      autor: 'Administración de Parques Nacionales',
      licencia: 'CC BY 4.0',
      licenciaUrl: 'https://creativecommons.org/licenses/by/4.0/deed.es',
    };
  }
  const v = c.variantes;
  const srcset = v
    ? ANCHOS.filter((a) => v[a]).map((a) => `${v[a]} ${a}w`).join(', ')
    : ANCHOS.map((a) => `${commons(archivo, a)} ${a}w`).join(', ');
  const cerca = ANCHOS.reduce((m, a) => (Math.abs(a - ancho) < Math.abs(m - ancho) ? a : m), ANCHOS[0]);
  return {
    archivo,
    src: v?.[cerca] ?? c.local ?? commons(archivo, cerca),
    srcset,
    pagina: `https://commons.wikimedia.org/wiki/File:${enc(archivo)}`,
    autor: c.autor,
    licencia: c.licencia,
    licenciaUrl: c.licenciaUrl,
  };
}

/** Lo que ocupa cada foto en pantalla, para que el navegador elija el ancho justo. */
export const TAMANOS = {
  // En celular (vertical) una foto de fondo que cubre toda la altura se recorta a lo ancho:
  // necesita bastante más resolución que el ancho de la pantalla para no verse borrosa.
  pantalla: '(orientation: portrait) 170vh, 100vw',
  tarjeta: '(max-width: 40rem) 82vw, (max-width: 72rem) 45vw, 22rem',
  tira: '(max-width: 40rem) 50vw, 25vw',
  galeria: '(max-width: 40rem) 100vw, 50vw',
};
