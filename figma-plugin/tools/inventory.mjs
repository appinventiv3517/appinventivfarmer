// Writes INVENTORY.md: every screen, state and component the data pack contains.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const m = JSON.parse(readFileSync(join(ROOT, 'data/manifest.json'), 'utf8'));
const comps = JSON.parse(readFileSync(join(ROOT, 'data/components.json'), 'utf8'));
const f = JSON.parse(readFileSync(join(ROOT, 'data/foundations.json'), 'utf8'));

let out = `# Screen, state and component inventory\n\nGenerated from the data pack captured on ${m.capturedAt}. This is everything the plugin builds.\n\n`;
for (const d of m.directions) {
  const list = m.screens.filter((s) => s.dir === d.id);
  const c = m.counts[d.id];
  out += `## ${d.title}\n\n${c.routes} screens, ${c.screens - c.routes} further states and flow steps, ${c.sets} component sets (${c.components} variants), ${f[d.id].tokens.length} tokens, ${f[d.id].textStyles.length} text styles, ${f[d.id].effects.length} effect styles.\n\n`;
  const groups = [...new Set(list.map((s) => s.group))];
  for (const g of groups) {
    out += `### ${g}\n\n| Screen | Route | States |\n|---|---|---|\n`;
    const rows = [...new Set(list.filter((s) => s.group === g).map((s) => s.row))];
    for (const r of rows) {
      const states = list.filter((s) => s.group === g && s.row === r);
      const route = (states.find((s) => s.primary) || states[0]).route || '';
      out += `| ${r.replace(/\|/g, '/')} | \`${route || '—'}\` | ${states.map((s) => s.state.replace(/\|/g, '/')).join(' · ')} |\n`;
    }
    out += '\n';
  }
  out += `### Components\n\n| Component set | Variants |\n|---|---|\n`;
  const sets = [...new Set(comps[d.id].map((x) => x.set))];
  for (const s of sets) {
    const vs = [...new Set(comps[d.id].filter((x) => x.set === s).map((x) => x.variant))];
    out += `| ${s} | ${vs.join(' · ')} |\n`;
  }
  out += '\n';
}
writeFileSync(join(ROOT, 'INVENTORY.md'), out);
console.log('INVENTORY.md written', out.length);
