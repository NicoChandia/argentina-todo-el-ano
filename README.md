# Argentina todo el año

Cada mes hay un lugar de la Argentina en su mejor momento. Los destinos más lindos del país y cuándo
ir a cada uno, con los datos oficiales de la **Encuesta de Ocupación Hotelera** (INDEC y Secretaría
de Turismo). En español (`/`), portugués (`/pt/`) e inglés (`/en/`).

Hecho con [Astro](https://astro.build). No usa JavaScript en el navegador: todo se genera al compilar.

## Cómo correrlo

```bash
npm install
npm run fotos    # baja las fotos de Wikimedia Commons a public/fotos/ con autor y licencia
npm run dev      # http://localhost:4321
```

Para actualizar los datos de temporada, poné los anexos de la EOH en `datos/` y corré:

```bash
pip install xlrd
npm run datos    # lee todos los .zip de datos/ y reescribe src/data/temporada.json
```

Cada anexo anual (`EOH_cuadros_dicAA.zip`) se baja de la
[página de la encuesta](https://www.indec.gob.ar/Nivel4/Tema/3/13/56). Con dos o más años, el sitio
muestra el promedio de cada mes.

Sin `npm run fotos` el sitio funciona igual: carga las fotos directo desde Commons, pero sin el
nombre del autor en el crédito. Antes de publicar, correlo siempre.

## Cómo está armado

| Archivo | Qué tiene |
|---|---|
| `src/data/destinos.json` | Los destinos de norte a sur: textos, imperdibles, fotos y su localidad en la EOH |
| `src/data/temporada.json` | Viajeros hospedados por mes y por localidad (lo genera `scripts/eoh.py`) |
| `src/data/lugares.json` | Puntos del mapa: las 52 localidades que mide INDEC y atracciones sin medición, con coordenadas |
| `src/data/provincias.geojson` | Límites provinciales de Georef (IGN), simplificados |
| `src/data/antartida.geojson` | Antártida Argentina e Islas del Atlántico Sur (IGN), para el recuadro que pide la Ley 22.963 |
| `src/data/creditos.json` | Autor y licencia de cada foto (lo genera `scripts/fotos.mjs`) |
| `src/pages/index.astro` | Portada, mapa por mes, calendario de temporadas y tarjetas por región |
| `src/components/Intro.astro` | Portada animada: cordillera con nubes generadas por código; al bajar, la foto se desarma en puntos que forman el mapa |
| `src/components/Mapa.astro` | El mapa: se dibuja al compilar con d3-geo; en el navegador solo cambia colores y el panel |
| `src/pages/[id].astro` | Una página por destino con su curva de temporada y galería |

## Idiomas

Todos los textos de la interfaz están en `src/i18n/index.ts`; los de cada destino, en
`src/data/destinos.json` (campos `nombre`, `lema`, `texto` e `imperdibles`, con una versión por idioma).
Para sumar un idioma, agregalo a `idiomas`, copiá un bloque de textos y traducilo. Las rutas, el
selector de idioma, las etiquetas `hreflang` y el sitemap se generan solos.

## Fotos por estación y portada

- `src/data/estaciones.json`: qué se hace en cada estación, por destino y en los tres idiomas.
- `src/data/fotos-estacion.json`: una foto de Commons por destino y estación. Para elegirlas:
  `npm run buscar-fotos`, abrí `fotos-candidatas.html`, tocá las que te gusten, copiá el resultado a ese
  archivo y corré `npm run fotos`.
- `src/data/portada.json`: qué destino y foto muestra la portada cada mes.

La portada elige el mes con un script mínimo autorizado por su hash en `vercel.json`. Si lo cambiás,
`npm run build` te avisa el hash nuevo que hay que poner.

## Sumar un destino

1. Agregalo en `src/data/destinos.json`, en el lugar que le toca de norte a sur.
2. En `fotos`, poné el nombre exacto del archivo en Wikimedia Commons (lo que va después de `File:`).
3. En `localidadEOH`, el nombre como figura en los cuadros de INDEC, o `null` si no está medida.
4. `npm run fotos` y `npm run datos`.

## Fuentes

- Viajeros: [INDEC, Encuesta de Ocupación Hotelera](https://www.indec.gob.ar/Nivel4/Tema/3/13/56). Mide hoteles y
  parahoteles en las principales localidades turísticas; no incluye campings ni alquileres temporarios.
- Fotos: [Wikimedia Commons](https://commons.wikimedia.org), cada una con su licencia y autor.
