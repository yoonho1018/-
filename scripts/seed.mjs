import { writeFile } from 'node:fs/promises';
import { GUIDES, CATEGORIES } from '../public/domain.mjs';
import { normalizeText } from '../public/similarity.mjs';
for (const category of CATEGORIES) {
  if (category.keywords.length !== 100 || new Set(category.keywords.map(normalizeText)).size !== 100) throw new Error(`Expected 100 unique terms: ${category.id}`);
}
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const array = values => 'array[' + values.map(quote).join(',') + ']';
const guides = GUIDES.map(g => `(${quote(g.name)}, ${quote(g.body)}, ${array(g.checklist)})`).join(',\n');
const categories = CATEGORIES.map((c,i) => `(${quote(c.id)}, ${quote(c.main)}, ${quote(c.name)}, ${array(c.keywords)}, ${quote(c.extra)}, ${i})`).join(',\n');
await writeFile('supabase/seed.sql', `-- Generated from public/domain.mjs. Run after schema.sql.\nbegin;\ninsert into public.main_guides(name, body, checklist) values\n${guides}\non conflict (name) do update set body = excluded.body, checklist = excluded.checklist;\ninsert into public.categories(id, main, name, keywords, extra, sort_order) values\n${categories}\non conflict (id) do update set main = excluded.main, name = excluded.name, keywords = excluded.keywords, extra = excluded.extra, sort_order = excluded.sort_order;\ncommit;\n`);
console.log('Created supabase/seed.sql');
await writeFile('supabase/update-keywords.sql', `-- Existing databases: update only keywords, preserving guides and reports.\nbegin;\n${CATEGORIES.map(c => `update public.categories set keywords = ${array(c.keywords)} where id = ${quote(c.id)};`).join('\n')}\ncommit;\n`);
