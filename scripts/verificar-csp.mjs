// Después de compilar, revisa que los scripts en línea de las páginas estén permitidos
// por su hash en la política de seguridad de vercel.json. Si alguien cambia el script
// de la portada y se olvida de actualizar el hash, la compilación falla con un aviso claro.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

async function* html(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* html(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const faltan = new Set();
for await (const archivo of html('dist')) {
  const texto = await readFile(archivo, 'utf8');
  // Todo <script> sin src que no sea de datos (application/json) cuenta como código en línea.
  for (const [, attrs, codigo] of texto.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs) || /application\/(ld\+)?json/.test(attrs)) continue;
    const hash = `'sha256-${createHash('sha256').update(codigo).digest('base64')}'`;
    if (!csp.includes(hash)) faltan.add(hash);
  }
}
if (faltan.size) {
  console.error(`\nHay scripts en línea que la política de seguridad no permite. Agregá a script-src en vercel.json:\n  ${[...faltan].join(' ')}\n`);
  process.exit(1);
}
console.log('Política de seguridad: todos los scripts en línea están permitidos.');
