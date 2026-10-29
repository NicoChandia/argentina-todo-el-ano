import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Cambiar por la dirección final cuando se publique en Vercel.
  site: 'https://argentina-todo-el-anio.vercel.app',
  // Que ningún script quede en línea: la política de seguridad solo permite archivos propios.
  vite: { build: { assetsInlineLimit: 0 } },
  // Sin la barra de herramientas de Astro en modo desarrollo.
  devToolbar: { enabled: false },
  // Todo el sitio se genera estático; solo /api/avisos.json corre en Vercel (avisos en vivo).
  output: 'static',
  adapter: vercel(),
});
