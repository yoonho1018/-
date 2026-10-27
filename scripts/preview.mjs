import { readFile, writeFile } from 'node:fs/promises';
let html = await readFile('public/index.html', 'utf8');
const css = await readFile('public/style.css', 'utf8');
const recommendationCSS = await readFile('public/recommendations.css', 'utf8');
const flatten = source => source.replace(/^import .*?;\s*$/gm, '').replace(/^export /gm, '');
const keywords = flatten(await readFile('public/keywords.mjs', 'utf8'));
const similarity = flatten(await readFile('public/similarity.mjs', 'utf8'));
const domain = flatten(await readFile('public/domain.mjs', 'utf8'));
const geography = flatten(await readFile('public/geography.mjs', 'utf8'));
const maps = flatten(await readFile('public/maps.mjs', 'utf8'));
const app = flatten(await readFile('public/app.mjs', 'utf8'));
const lucide = await readFile('public/vendor/lucide.js', 'utf8');
const mapCSS = await readFile('public/maps.css', 'utf8');
const leafletCSS = await readFile('public/vendor/leaflet.css', 'utf8');
const leafletJS = await readFile('public/vendor/leaflet.js', 'utf8');
const heatJS = await readFile('public/vendor/leaflet-heat.js', 'utf8');
const photo = (await readFile('public/assets/street.jpg')).toString('base64');
html = html.replace('<link rel="stylesheet" href="/style.css">', () => `<style>${css}</style>`)
  .replace('<link rel="stylesheet" href="/recommendations.css">', () => `<style>${recommendationCSS}</style>`)
  .replace('<link rel="stylesheet" href="/vendor/leaflet.css">', () => `<style>${leafletCSS}</style>`)
  .replace('<link rel="stylesheet" href="/maps.css">', () => `<style>${mapCSS}</style>`)
  .replace('<script src="/config.js"></script>', '<script>window.APP_CONFIG = {url:"",key:""};</script>')
  .replace(/  <script defer src="\/vendor\/[^\"]+"><\/script>\n/g, '')
  .replace('  <script type="module" src="/app.mjs"></script>', '')
  .replace('</body>', () => `<script>${lucide.replace(/<\/script/gi, '<\\/script')}</script><script>${leafletJS}\n${heatJS}</script><script type="module">${keywords}\n${similarity}\n${domain}\n${geography}\n${maps}\n${app.replace('/assets/street.jpg', `data:image/jpeg;base64,${photo}`)}</script></body>`);
await writeFile('index.html', html);
console.log('Standalone preview: index.html (demo only, no network required)');
