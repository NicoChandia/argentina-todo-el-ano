"""Convierte los anexos de cuadros de la Encuesta de Ocupación Hotelera (INDEC) en
src/data/temporada.json.

    pip install xlrd
    python scripts/eoh.py                      # usa todos los .zip de la carpeta datos/
    python scripts/eoh.py datos/EOH_cuadros_dic25.zip

Los anexos se bajan de https://www.indec.gob.ar/Nivel4/Tema/3/13/56 ("Anexo de cuadros AAAA").
De cada zip usa el archivo *demanda_cuadros.xls: una hoja por localidad con los viajeros
hospedados de cada mes. Guarda todas las localidades, aunque el sitio use solo algunas.
Los meses que INDEC marca con (1), coeficiente de variación mayor al 20 %, quedan
anotados en "inciertos" para avisarlo en el gráfico.
"""

import json
import re
import sys
import zipfile
from pathlib import Path

import xlrd

SALIDA = Path(__file__).resolve().parent.parent / "src" / "data" / "temporada.json"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def leer_libro(contenido: bytes, origen: str, localidades: dict) -> set:
    libro = xlrd.open_workbook(file_contents=contenido)
    anios = set()
    for hoja in libro.sheets():
        if hoja.nrows < 12 or hoja.name.lower().startswith(("índice", "indice")):
            continue
        titulo = str(hoja.cell_value(1, 0))
        m = re.match(r"\s*(.+?)\s*\.\s*Año\s*(\d{4})", titulo)
        if not m:
            print(f"  ? {origen} / {hoja.name}: no entiendo el título «{titulo}»")
            continue
        nombre, anio = m.group(1).strip(), m.group(2)
        # Las hojas "Reg_*" y "Total país" son agregados regionales; la única que es
        # una localidad es la Ciudad de Buenos Aires (Reg_caba).
        hoja_nombre = hoja.name.lower()
        if hoja_nombre.startswith("total") or (hoja_nombre.startswith("reg_") and "caba" not in hoja_nombre):
            continue
        if nombre == "CABA":
            nombre = "Ciudad de Buenos Aires"

        # Fila de meses y fila de viajeros (la primera que dice "Viajeros").
        fila_meses = next(r for r in range(hoja.nrows)
                          if any(str(c).strip().lower() == "enero" for c in hoja.row_values(r)))
        fila_viaj = next(r for r in range(hoja.nrows)
                         if str(hoja.cell_value(r, 0)).strip().lower() == "viajeros")

        valores = [None] * 12
        inciertos = []
        for col, celda in enumerate(hoja.row_values(fila_meses)):
            mes = str(celda).strip().lower()
            if mes not in MESES:
                continue
            i = MESES.index(mes)
            v = hoja.cell_value(fila_viaj, col)
            if isinstance(v, float):
                valores[i] = int(round(v))
                marca = hoja.cell_value(fila_viaj, col + 1) if col + 1 < hoja.ncols else ""
                if str(marca).strip() in ("1", "1.0", "(1)"):
                    inciertos.append(i)

        if sum(v is not None for v in valores) == 0:
            continue
        localidades.setdefault(nombre, {})[anio] = valores
        if inciertos:
            localidades[nombre].setdefault("_inciertos", {})[anio] = inciertos
        anios.add(anio)
    return anios


def main(rutas: list[str]) -> None:
    if not rutas:
        carpeta = SALIDA.parent.parent.parent / "datos"
        rutas = sorted(str(p) for p in carpeta.glob("*.zip"))
    if not rutas:
        sys.exit(__doc__)
    localidades: dict = {}
    anios: set = set()
    for ruta in rutas:
        p = Path(ruta)
        if p.suffix.lower() == ".zip":
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if n.lower().endswith("demanda_cuadros.xls"):
                        anios |= leer_libro(z.read(n), f"{p.name}/{n}", localidades)
        else:
            anios |= leer_libro(p.read_bytes(), p.name, localidades)

    # Separa las marcas de incertidumbre de las series.
    salida = {}
    for nombre, series in sorted(localidades.items()):
        inciertos = series.pop("_inciertos", {})
        salida[nombre] = {"viajeros": series, "inciertos": inciertos}

    datos = {
        "fuente": "INDEC, Encuesta de Ocupación Hotelera",
        "unidad": "viajeros hospedados",
        "anios": sorted(anios),
        "localidades": salida,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Listo: {len(salida)} localidades, años {', '.join(sorted(anios))} → {SALIDA}")


if __name__ == "__main__":
    main(sys.argv[1:])
