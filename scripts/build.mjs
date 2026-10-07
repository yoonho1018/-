import { cp, mkdir, writeFile } from 'node:fs/promises';
import { configuration, configScript } from './config.mjs';
// An explicit flag allows a public demo without silently hiding missing DB settings.
const demo = process.env.DEMO_MODE === 'true';
const config = demo ? { url: '', key: '' } : configuration(process.env, true);
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await writeFile('dist/config.js', configScript(config));
console.log(`Build complete: dist (${demo ? 'demo: browser-only storage' : 'Supabase connected configuration'})`);
