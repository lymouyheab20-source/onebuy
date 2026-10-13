// Bundle dist/ into one self-contained HTML file (JS, CSS and icon inlined).
// Usage: node scripts/build-single.mjs [out-file]   (run after `npm run build`)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const out = process.argv[2] ?? join(dist, 'onebuy-single.html');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, f) => `<style>${readFileSync(join(dist, f), 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, f) => {
  const js = readFileSync(join(dist, f), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
const icon = 'data:image/svg+xml;base64,' + readFileSync(join(dist, 'favicon.svg')).toString('base64');
html = html.replace(/href="\.\/favicon\.svg"/, `href="${icon}"`);
// PWA files are not available in a single file.
html = html.replace(/\s*<link rel="(manifest|apple-touch-icon)"[^>]*>/g, '');

if (process.argv.includes('--fragment')) {
  // Body-only form for hosts that wrap the page in their own document skeleton.
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/\s*<meta (charset|name="viewport")[^>]*>/g, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
  html = title + '\n' + head.replace(title, '') + '\n' + body;
}
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
