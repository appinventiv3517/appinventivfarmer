#!/usr/bin/env node
/*
 * Reads src/styles/tokens.css and writes figma-plugin/data/tokens.json:
 * colour tokens (light + dark, references resolved), type scale, radii,
 * spacing and shadows, grouped the way the CSS file groups them.
 */
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'tokens.css'), 'utf8');

function block(selectorRe) {
  const m = css.match(selectorRe);
  if (!m) return '';
  let i = m.index + m[0].length, depth = 1, out = '';
  while (i < css.length && depth > 0) {
    const ch = css[i++];
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth > 0) out += ch;
  }
  return out;
}

function parseVars(text) {
  const vars = [];
  let group = 'Other';
  for (const line of text.split('\n')) {
    const g = line.match(/\/\*\s*-+\s*(.+?)\s*-+\s*\*\//);
    if (g) {
      group = g[1].replace(/\s*\(.*\)$/, '');
      continue;
    }
    const m = line.match(/^\s*--([\w-]+):\s*([^;]+);(?:\s*\/\*\s*(.*?)\s*\*\/)?/);
    if (m) vars.push({ name: m[1], value: m[2].trim(), group, note: m[3] || '' });
  }
  return vars;
}

const light = parseVars(block(/:root\s*\{/));
const darkOver = parseVars(block(/:root\[data-theme='dark'\]\s*\{/));
const lightMap = Object.fromEntries(light.map((v) => [v.name, v.value]));
const darkMap = { ...lightMap, ...Object.fromEntries(darkOver.map((v) => [v.name, v.value])) };

function resolve(value, map, depth = 0) {
  if (depth > 10) return value;
  return value.replace(/var\(--([\w-]+)(?:,\s*([^)]+))?\)/g, (_, n, fb) => (map[n] !== undefined ? resolve(map[n], map, depth + 1) : fb || ''));
}

function toRGBA(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
  }
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (m) return [m[1] / 255, m[2] / 255, m[3] / 255, m[4] === undefined ? 1 : +m[4]];
  return null;
}
const round = (c) => c.map((x) => Math.round(x * 10000) / 10000);

const colors = [];
for (const v of light) {
  const lv = toRGBA(resolve(v.value, lightMap));
  if (!lv) continue;
  const dv = toRGBA(resolve(darkMap[v.name], darkMap)) || lv;
  colors.push({ name: v.name, group: v.group, light: round(lv), dark: round(dv), note: v.note, ref: (v.value.match(/^var\(--([\w-]+)\)$/) || [])[1] || null });
}

const type = light
  .filter((v) => v.name.startsWith('t-'))
  .map((v) => {
    const m = v.value.match(/^(\d+)\s+([\d.]+)rem\/([\d.]+)/);
    return { name: v.name.slice(2), weight: +m[1], size: Math.round(+m[2] * 16 * 100) / 100, lineHeight: Math.round(+m[2] * 16 * +m[3] * 100) / 100, note: v.note };
  });
const LETTER = { display: -0.025, title: -0.02, headline: -0.016, heading: -0.012, subheading: -0.006, overline: 0.08 };
type.forEach((t) => (t.letterSpacing = Math.round((LETTER[t.name] || 0) * t.size * 100) / 100));
const upper = new Set(['overline']);
type.forEach((t) => (t.upper = upper.has(t.name)));

const px = (v) => parseFloat(v);
const radii = light.filter((v) => /^r-/.test(v.name)).map((v) => ({ name: v.name, value: px(v.value) }));
const space = light.filter((v) => /^s-\d+$/.test(v.name) || v.name === 'gutter' || v.name.startsWith('space-')).map((v) => ({ name: v.name, value: px(v.value) }));

function shadow(str) {
  const out = [];
  let depth = 0, cur = '';
  const parts = [];
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());
  for (const p of parts) {
    const m = p.match(/^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?(?:\s+(-?[\d.]+)(?:px)?)?\s+(rgba?\([^)]+\))$/);
    if (m) out.push({ x: +m[1], y: +m[2], blur: +m[3], spread: +(m[4] || 0), color: round(toRGBA(m[5])) });
  }
  return out;
}
const shadows = light.filter((v) => v.name.startsWith('shadow-')).map((v) => ({ name: v.name, light: shadow(v.value), dark: shadow(darkMap[v.name]) }));

const out = { source: 'src/styles/tokens.css', font: 'Plus Jakarta Sans', colors, type, radii, space, shadows };
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'data', 'tokens.json'), JSON.stringify(out, null, 1));
console.log(`${colors.length} colours, ${type.length} type styles, ${radii.length} radii, ${space.length} spacing, ${shadows.length} shadows`);
