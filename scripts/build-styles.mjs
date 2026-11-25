/**
 * Genera src/styles.css usando PostCSS + @tailwindcss/postcss.
 * Lee src/styles.input.css → escanea templates → escribe src/styles.css
 *
 * Usage:
 *   node scripts/build-styles.mjs          → build once
 *   node scripts/build-styles.mjs --watch  → rebuild on file changes
 */

import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'src', 'styles.input.css');
const output = path.join(root, 'src', 'styles.css');

async function build() {
  const css = fs.readFileSync(input, 'utf8');
  const result = await postcss([tailwind()]).process(css, {
    from: input,
    to: output,
  });
  fs.writeFileSync(output, result.css);
  console.log(`[tw] styles.css updated (${result.css.split('\n').length} lines)`);
}

const watch = process.argv.includes('--watch');

build().catch(console.error);

if (watch) {
  // Node's fs.watch con recursive:true (soportado en Windows y macOS) en vez
  // de chokidar: chokidar v4+ eliminó el soporte de patrones glob como
  // 'src/app/**/*.html' — pasado tal cual no matchea nada y el watcher queda
  // silenciosamente inerte (no hay error, simplemente nunca dispara).
  console.log('[tw] watching src/app/**/*.{html,ts}...');
  let debounce;
  const scheduleBuild = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => build().catch(console.error), 200);
  };
  fs.watch(path.join(root, 'src', 'app'), { recursive: true }, (_event, filename) => {
    if (filename && /\.(html|ts)$/.test(filename)) scheduleBuild();
  });
  fs.watch(input, scheduleBuild);
}
