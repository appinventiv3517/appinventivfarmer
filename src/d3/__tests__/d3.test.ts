import { describe, expect, it } from 'vitest';
import { fromD3, isD3Path, isTabRoot, to } from '../paths';
import { SLOTS, resolvePhoto, slotFor } from '../photo/catalog';
import { counterpartPath, directionOf, pathIn } from '@/app/DirectionSwitcher';
import { buildContent } from '@/data/content';
import { buildEvents } from '@/data/events';

describe('Ver 3 paths', () => {
  it('maps shared paths into /d3 and back', () => {
    expect(to('/orders/fom/FOM1')).toBe('/d3/orders/fom/FOM1');
    expect(to('/d3/home')).toBe('/d3/home');
    expect(to('/')).toBe('/d3');
    expect(fromD3('/d3/learn')).toBe('/learn');
    expect(isD3Path('/d3x')).toBe(false);
    expect(isTabRoot('/d3/account')).toBe(true);
  });
  it('switches the same screen between directions', () => {
    expect(pathIn('d3', '/events/e-training')).toBe('/d3/events/e-training');
    expect(pathIn('d3', '/d2/search')).toBe('/d3/search');
    expect(pathIn('d2', '/d3/orders')).toBe('/d2/orders');
    expect(counterpartPath('/d3/events/e-training')).toBe('/events/e-training');
    expect(counterpartPath('/d3/search')).toBe('/learn');
    expect(directionOf('/d3/welcome/language')).toBe('d3');
    expect(directionOf('/d2')).toBe('d2');
  });
});

describe('Ver 3 photo slots', () => {
  it('gives every content item and event a known slot', () => {
    const ids = new Set(SLOTS.map((s) => s.id));
    for (const c of buildContent()) expect(ids.has(slotFor(c.scene, c.id))).toBe(true);
    for (const e of buildEvents()) expect(ids.has(slotFor(e.scene, e.id))).toBe(true);
  });
  it('slot ids are unique and have briefs and alt text', () => {
    expect(new Set(SLOTS.map((s) => s.id)).size).toBe(SLOTS.length);
    for (const s of SLOTS) {
      expect(s.subject.length).toBeGreaterThan(20);
      expect(s.alt.length).toBeGreaterThan(5);
    }
  });
  it('prefers a real photo from data over the slot', () => {
    expect(resolvePhoto('harvest-baler', 'x.jpg').src).toBe('x.jpg');
  });
});
