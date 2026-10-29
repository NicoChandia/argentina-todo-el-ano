import lugares from '../data/lugares.json';
import info from '../data/provincias-info.json';
import { destinos } from '../data/destinos';

type Lugar = (typeof lugares)[number] & { foto?: string; soloProvincia?: boolean };

/** Archivo de Commons de la foto de un lugar: la propia, o la primera de su ficha. */
export function archivoLugar(l: Lugar): string | null {
  if (l.foto) return l.foto;
  if (l.destino) return destinos.find((d) => d.id === l.destino)?.fotos[0] ?? null;
  return null;
}

/** Foto de portada de una provincia (la de su lugar elegido como portada). */
export function archivoProvincia(slug: string): string | null {
  const p = info.find((i) => i.slug === slug) as (typeof info)[number] & { portada?: string };
  if (!p?.portada) return null;
  const l = (lugares as Lugar[]).find((x) => x.nombre === p.portada);
  return l ? archivoLugar(l) : null;
}

export const cantidadLugares = (provincia: string) => lugares.filter((l) => l.provincia === provincia).length;
