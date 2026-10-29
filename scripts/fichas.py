"""Suma las fichas escritas en datos/fichas/*.json a src/data/destinos.json.

Cada ficha nombra el lugar de src/data/lugares.json que describe ("lugar"); de ahí salen
la provincia, las coordenadas, la localidad de INDEC y la primera foto. Las fotos extra
van en "fotos" dentro de la ficha. Al final ordena todo de norte a sur y enlaza cada
lugar con su ficha. Se puede correr las veces que haga falta: reemplaza, no duplica.
"""
import glob, json

D = 'src/data/destinos.json'
L = 'src/data/lugares.json'
destinos = json.load(open(D, encoding='utf-8'))
lugares = json.load(open(L, encoding='utf-8'))
info = json.load(open('src/data/provincias-info.json', encoding='utf-8'))
region = {p['nombre']: p['region'] for p in info}

def grados(lat):
    a = abs(lat); g = int(a); m = round((a - g) * 60)
    if m == 60: g, m = g + 1, 0
    return f"{g}°{m:02d}′ S"

por_id = {d['id']: d for d in destinos}
for archivo in sorted(glob.glob('datos/fichas/*.json')):
    for f in json.load(open(archivo, encoding='utf-8')):
        l = next(x for x in lugares if x['nombre'] == f['lugar'])
        fotos = [x for x in [l.get('foto'), *f.get('fotos', [])] if x]
        fotos = list(dict.fromkeys(fotos))
        d = {
            'id': f['id'], 'nombre': f['nombre'], 'provincia': l['provincia'],
            'region': region[l['provincia']], 'latitud': grados(l['lat']),
            'lat': l['lat'], 'lon': l['lon'],
            'lema': f['lema'], 'texto': f['texto'], 'imperdibles': f['imperdibles'],
            'llegar': f.get('llegar'), 'cuando': f.get('cuando'), 'fotos': fotos,
            'localidadEOH': l.get('localidadEOH'), 'destacado': False,
        }
        if not fotos:
            print(f"  aviso: {f['id']} no tiene fotos")
        por_id[f['id']] = {**por_id.get(f['id'], {}), **d}
        l['destino'] = f['id']

# coordenadas de los destinos originales, desde su lugar
for l in lugares:
    if l.get('destino') in por_id:
        por_id[l['destino']].setdefault('lat', l['lat'])
        por_id[l['destino']].setdefault('lon', l['lon'])

todos = sorted(por_id.values(), key=lambda d: (-d['lat'], d['lon']))
json.dump(todos, open(D, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(lugares, open(L, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(todos), 'destinos')
