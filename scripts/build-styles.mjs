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
  const { glob } = await import('glob');
  const chokidar = await import('chokidar').then(m => m.default).catch(() => null);

  if (!chokidar) {
    // Fallback: polling sin chokidar
    console.log('[tw] watching src/app/**/*.{html,ts} (polling)...');
    let debounce;
    fs.watch(path.join(root, 'src', 'app'), { recursive: true }, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => build().catch(console.error), 300);
    });
    fs.watch(input, () => build().catch(console.error));
  } else {
    console.log('[tw] watching src/app/**/*.{html,ts}...');
    chokidar
      .watch(['src/app/**/*.html', 'src/app/**/*.ts', 'src/styles.input.css'], {
        cwd: root,
        ignoreInitial: true,
      })
      .on('all', () => build().catch(console.error));
  }
}
