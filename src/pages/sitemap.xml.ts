// Sitemap con las tres versiones de cada página, enlazadas entre sí para Google.
import type { APIRoute } from 'astro';
import { destinos } from '../data/destinos';
import info from '../data/provincias-info.json';
import { htmlLang, idiomas, url } from '../i18n';

export const GET: APIRoute = ({ site }) => {
  const abs = (ruta: string) => (site ? new URL(ruta, site).href : ruta);
  const rutas = ['', ...destinos.map((d) => `${d.id}/`), ...info.map((p) => `provincia/${p.slug}/`)];
  const entradas = rutas.flatMap((ruta) =>
    idiomas.map((lang) => {
      const alternas = idiomas
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${htmlLang[l]}" href="${abs(url(l, ruta))}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${abs(url(lang, ruta))}</loc>\n${alternas}\n  </url>`;
    }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entradas.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
