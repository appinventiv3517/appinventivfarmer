import { daysFromNow, isoDay } from './dates';

/**
 * Farmer data collection: a "form cycle" follows one crop on one plot through
 * eight steps, from land preparation to transport. Field lists follow the
 * design (Farmer – Data Collection Flow). Totals are plain sums of what the
 * Didi enters; each one says how it is worked out.
 */

export type StepKey = 'land_prep' | 'sowing' | 'intercultivation' | 'water' | 'nutrient' | 'pesticide' | 'harvest' | 'transport';
export type Entry = Record<string, string>;

export interface FieldDef {
  key: string;
  label: string;
  kind: 'date' | 'number' | 'money' | 'text' | 'textarea' | 'select' | 'computed';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  /** Shown after numbers, e.g. "acres", "L". */
  unit?: string;
  /** For computed fields. */
  compute?: (e: Entry, ctx: Ctx) => number | null;
  money?: boolean;
  explain?: string;
}
export interface SectionDef {
  title: string;
  fields: FieldDef[];
}
export interface StepDef {
  key: StepKey;
  title: string;
  /** Short name for the 8-tile grid. */
  short: string;
  /** More than one entry can be added (e.g. each irrigation). */
  repeatable: boolean;
  sections: SectionDef[];
}
/** Context for computed fields: the crop's sowing date, if known. */
export interface Ctx {
  sown?: string;
}

const n = (v?: string) => {
  const x = parseFloat(v ?? '');
  return Number.isFinite(x) ? x : 0;
};
const has = (e: Entry, ...k: string[]) => k.some((x) => (e[x] ?? '') !== '');

const daysAfterSowing: FieldDef = {
  key: 'das',
  label: 'Days after sowing / transplanting',
  kind: 'computed',
  unit: 'days',
  explain: 'Worked out from this date and the crop’s sowing date.',
  compute: (e, ctx) => {
    if (!e.date || !ctx.sown) return null;
    const d = Math.round((new Date(`${e.date}T00:00`).getTime() - new Date(`${ctx.sown.slice(0, 10)}T00:00`).getTime()) / 86_400_000);
    return d >= 0 ? d : null;
  },
};
const date: FieldDef = { key: 'date', label: 'Date', kind: 'date', required: true };
const cropStage: FieldDef = { key: 'cropStage', label: 'Crop stage', kind: 'text', placeholder: 'e.g. Vegetative' };

const labourCost = (e: Entry) => (n(e.maleCount) * n(e.maleWage) + n(e.femaleCount) * n(e.femaleWage)) * n(e.lHours) * n(e.lDays);
const labour: SectionDef = {
  title: 'Labour details',
  fields: [
    { key: 'maleCount', label: 'Male labour count', kind: 'number' },
    { key: 'maleWage', label: 'Male labour wages (per hour)', kind: 'money' },
    { key: 'femaleCount', label: 'Female labour count', kind: 'number' },
    { key: 'femaleWage', label: 'Female labour wages (per hour)', kind: 'money' },
    { key: 'totalLabour', label: 'Total labour count', kind: 'computed', explain: 'Male + female labour.', compute: (e) => (has(e, 'maleCount', 'femaleCount') ? n(e.maleCount) + n(e.femaleCount) : null) },
    { key: 'lHours', label: 'Working hours per day', kind: 'number', unit: 'hours' },
    { key: 'lDays', label: 'Total working days', kind: 'number', unit: 'days' },
    { key: 'labourCost', label: 'Total labour cost', kind: 'computed', money: true, explain: '(Male count × wage + female count × wage) × hours per day × working days.', compute: (e) => (has(e, 'maleCount', 'femaleCount') ? labourCost(e) : null) },
  ],
};
const other: FieldDef = { key: 'other', label: 'Other cost', kind: 'money' };
const total = (label: string, explain: string, f: (e: Entry) => number): SectionDef => ({
  title: 'Total cost',
  fields: [other, { key: 'total', label, kind: 'computed', money: true, explain, compute: (e) => f(e) }],
});

const prepTime = (e: Entry) => n(e.hours) * n(e.days);

export const STEPS: StepDef[] = [
  {
    key: 'land_prep',
    title: 'Land Preparation',
    short: 'Land prep',
    repeatable: false,
    sections: [
      { title: 'Preparation', fields: [date, { key: 'prepType', label: 'Preparation type', kind: 'select', required: true, options: ['Ploughing', 'Harrowing', 'Rotavating', 'Levelling', 'Other'] }] },
      {
        title: 'Machinery details',
        fields: [
          { key: 'machinery', label: 'Machinery used', kind: 'select', options: ['Tractor', 'Plough', 'Rotavator', 'Cultivator', 'Harrow', 'Leveller', 'Other'] },
          { key: 'machineryStatus', label: 'Machinery status', kind: 'select', options: ['Owned', 'Rented', 'Hired', 'Other'] },
          { key: 'rent', label: 'Rent paid', kind: 'money' },
          { key: 'hours', label: 'Working hours per day', kind: 'number', unit: 'hours' },
          { key: 'days', label: 'Working days', kind: 'number', unit: 'days' },
          { key: 'prepTime', label: 'Total preparation time', kind: 'computed', unit: 'hours', explain: 'Hours per day × working days.', compute: (e) => (has(e, 'hours', 'days') ? prepTime(e) : null) },
          { key: 'fuelPerHour', label: 'Fuel consumption per hour', kind: 'number', unit: 'L' },
          { key: 'fuel', label: 'Total fuel consumption', kind: 'computed', unit: 'L', explain: 'Fuel per hour × total preparation time.', compute: (e) => (has(e, 'fuelPerHour') ? n(e.fuelPerHour) * prepTime(e) : null) },
          { key: 'fuelCostPerHour', label: 'Fuel cost per hour', kind: 'money' },
          { key: 'fuelCost', label: 'Total fuel cost', kind: 'computed', money: true, explain: 'Fuel cost per hour × total preparation time.', compute: (e) => (has(e, 'fuelCostPerHour') ? n(e.fuelCostPerHour) * prepTime(e) : null) },
        ],
      },
      labour,
      total('Total cost', 'Rent + fuel cost + labour cost + other cost.', (e) => n(e.rent) + n(e.fuelCostPerHour) * prepTime(e) + labourCost(e) + n(e.other)),
    ],
  },
  {
    key: 'sowing',
    title: 'Sowing & Transplantation',
    short: 'Sowing',
    repeatable: false,
    sections: [{ title: 'Sowing', fields: [date, { key: 'seedOrSapling', label: 'Seed or sapling', kind: 'select', required: true, options: ['Seed', 'Sapling'] }] }],
  },
  {
    key: 'intercultivation',
    title: 'Intercultivation',
    short: 'Intercult.',
    repeatable: true,
    sections: [
      {
        title: 'Intercultivation',
        fields: [date, daysAfterSowing, cropStage, { key: 'weeding', label: 'Weeding stage', kind: 'select', options: ['First weeding', 'Second weeding', 'Third weeding'] }, { key: 'method', label: 'Method adopted', kind: 'select', required: true, options: ['Manual', 'Mechanized'] }, { key: 'area', label: 'Area covered', kind: 'number', unit: 'acres' }],
      },
      total('Total intercultivation cost', 'Other cost.', (e) => n(e.other)),
    ],
  },
  {
    key: 'water',
    title: 'Water Management',
    short: 'Water',
    repeatable: true,
    sections: [
      { title: 'Water management', fields: [date, { key: 'farmingType', label: 'Farming type', kind: 'select', required: true, options: ['Irrigated', 'Rainfed'] }] },
      {
        title: 'Irrigation details',
        fields: [cropStage, daysAfterSowing, { key: 'irrigationNo', label: 'Irrigation number', kind: 'number' }, { key: 'source', label: 'Water source', kind: 'select', options: ['Canal', 'Borewell', 'River', 'Pond', 'Tank'] }, { key: 'irrigationMethod', label: 'Irrigation method', kind: 'select', options: ['Flood irrigation', 'Drip irrigation', 'Sprinkler', 'Furrow irrigation'] }, { key: 'area', label: 'Area irrigated', kind: 'number', unit: 'acres' }, { key: 'time', label: 'Time taken', kind: 'number', unit: 'hours' }],
      },
      labour,
      total('Total water management cost', 'Labour cost + other cost.', (e) => labourCost(e) + n(e.other)),
    ],
  },
  {
    key: 'nutrient',
    title: 'Nutrient Management',
    short: 'Nutrients',
    repeatable: true,
    sections: [
      { title: 'Nutrient management', fields: [date, cropStage, daysAfterSowing, { key: 'applicationStage', label: 'Application stage', kind: 'select', options: ['Basal application', 'Top dressing', 'Foliar application'] }, { key: 'recommendations', label: 'Nutrient recommendations', kind: 'textarea' }] },
      {
        title: 'Fertilizer details',
        fields: [
          { key: 'fertilizer', label: 'Fertilizer name', kind: 'text', placeholder: 'e.g. Urea' },
          { key: 'qty', label: 'Quantity', kind: 'number', unit: 'kg' },
          { key: 'costPerKg', label: 'Cost per kg', kind: 'money' },
          { key: 'fertCost', label: 'Total fertilizer cost', kind: 'computed', money: true, explain: 'Quantity × cost per kg.', compute: (e) => (has(e, 'qty', 'costPerKg') ? n(e.qty) * n(e.costPerKg) : null) },
          { key: 'area', label: 'Area applied', kind: 'number', unit: 'acres' },
          { key: 'applicationMethod', label: 'Application method', kind: 'select', options: ['Broadcasting', 'Band placement', 'Foliar spray', 'Fertigation', 'Other'] },
        ],
      },
      total('Total nutrient management cost', 'Fertilizer cost + other cost.', (e) => n(e.qty) * n(e.costPerKg) + n(e.other)),
    ],
  },
  {
    key: 'pesticide',
    title: 'Pesticide Management',
    short: 'Pesticides',
    repeatable: true,
    sections: [
      { title: 'Pesticide management', fields: [date, cropStage, daysAfterSowing] },
      {
        title: 'Pest and chemical details',
        fields: [
          { key: 'pest', label: 'Pest / disease name', kind: 'text' },
          { key: 'recommendations', label: 'Recommendations', kind: 'textarea' },
          { key: 'chemical', label: 'Chemical name', kind: 'text' },
          { key: 'qty', label: 'Quantity used', kind: 'number', unit: 'L or kg' },
          { key: 'costPerUnit', label: 'Chemical cost (per unit)', kind: 'money' },
          { key: 'chemCost', label: 'Total chemical cost', kind: 'computed', money: true, explain: 'Quantity × cost per unit.', compute: (e) => (has(e, 'qty', 'costPerUnit') ? n(e.qty) * n(e.costPerUnit) : null) },
          { key: 'area', label: 'Area covered', kind: 'number', unit: 'acres' },
          { key: 'applicationMethod', label: 'Application method', kind: 'select', options: ['Backpack sprayer', 'Power sprayer', 'Drone'] },
        ],
      },
      labour,
      total('Total pesticide management cost', 'Chemical cost + labour cost + other cost.', (e) => n(e.qty) * n(e.costPerUnit) + labourCost(e) + n(e.other)),
    ],
  },
  {
    key: 'harvest',
    title: 'Harvest Management',
    short: 'Harvest',
    repeatable: true,
    sections: [
      { title: 'Harvest management', fields: [date, cropStage, daysAfterSowing, { key: 'harvestNo', label: 'Harvest number', kind: 'number' }, { key: 'area', label: 'Harvested area', kind: 'number', unit: 'acres' }, { key: 'method', label: 'Harvest method', kind: 'select', options: ['Manual', 'Mechanized'] }] },
      total('Total harvest cost', 'Other cost.', (e) => n(e.other)),
    ],
  },
  {
    key: 'transport',
    title: 'Transportation',
    short: 'Transport',
    repeatable: true,
    sections: [
      { title: 'Transportation', fields: [date, { key: 'what', label: 'What was transported', kind: 'text', placeholder: 'e.g. Wheat, rice, fertilizer' }, { key: 'weight', label: 'Approximate weight', kind: 'number', unit: 'kg' }] },
      {
        title: 'Transport details',
        fields: [
          { key: 'mode', label: 'Transport mode', kind: 'select', options: ['Tractor', 'Truck', 'Auto rickshaw', 'Bullock cart', 'Other'] },
          { key: 'fuelType', label: 'Fuel type', kind: 'select', options: ['Diesel', 'Petrol', 'CNG', 'Electric', 'None'] },
          { key: 'fuelCost', label: 'Fuel cost (per L)', kind: 'money' },
          { key: 'economy', label: 'Fuel economy', kind: 'number', unit: 'km/L' },
          { key: 'distance', label: 'Total distance', kind: 'number', unit: 'km' },
          { key: 'tripFuel', label: 'Fuel cost for the trip', kind: 'computed', money: true, explain: 'Distance ÷ fuel economy × fuel cost per litre.', compute: (e) => (n(e.economy) > 0 && has(e, 'distance', 'fuelCost') ? (n(e.distance) / n(e.economy)) * n(e.fuelCost) : null) },
        ],
      },
      total('Total transportation cost', 'Trip fuel cost + other cost.', (e) => (n(e.economy) > 0 ? (n(e.distance) / n(e.economy)) * n(e.fuelCost) : 0) + n(e.other)),
    ],
  },
];

export const stepDef = (k: string) => STEPS.find((s) => s.key === k);
export const STEP_ORDER = STEPS.map((s) => s.key);

export interface StepRecord {
  entries: Entry[];
  submittedAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Cycle {
  id: string;
  no: number;
  farmerId: string;
  landId: string;
  startedAt: string;
  steps: Partial<Record<StepKey, StepRecord>>;
}

export const submittedCount = (c: Cycle) => STEP_ORDER.filter((k) => c.steps[k]).length;
export const isComplete = (c: Cycle) => submittedCount(c) === STEPS.length;
/** The first step not yet submitted. Steps are filled in order. */
export const nextStep = (c: Cycle): StepKey | undefined => STEP_ORDER.find((k) => !c.steps[k]);

/** Required fields left empty in an entry, by label. */
export function missing(step: StepDef, e: Entry): string[] {
  return step.sections.flatMap((s) => s.fields).filter((f) => f.required && !(e[f.key] ?? '').trim()).map((f) => f.label);
}

/** Display value for a field: entered or computed. Empty fields return null. */
export function shown(f: FieldDef, e: Entry, ctx: Ctx): string | null {
  if (f.kind === 'computed') {
    const v = f.compute?.(e, ctx);
    if (v === null || v === undefined) return null;
    return f.money ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : `${Number(v.toFixed(2))}${f.unit ? ` ${f.unit}` : ''}`;
  }
  const raw = (e[f.key] ?? '').trim();
  if (!raw) return null;
  if (f.kind === 'money') return `₹${n(raw).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  if (f.kind === 'date') return new Date(`${raw}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return f.unit ? `${raw} ${f.unit}` : raw;
}

/* ---------- Sample cycles (Ram Prasad Yadav) ---------- */

const day = (n2: number) => isoDay(new Date(daysFromNow(n2, 10)));
const rec = (entries: Entry[], at: number): StepRecord => ({ entries, submittedAt: daysFromNow(at, 16), updatedAt: daysFromNow(at, 16), updatedBy: 'Sumita Kumari (KD)' });

export const SAMPLE_CYCLES: Cycle[] = [
  {
    id: 'c1',
    no: 1,
    farmerId: 'KU-F-10231',
    landId: 'l1',
    startedAt: daysFromNow(-165, 9),
    steps: {
      land_prep: rec([{ date: day(-165), prepType: 'Ploughing', machinery: 'Tractor', machineryStatus: 'Rented', rent: '1800', hours: '6', days: '2', fuelPerHour: '4', fuelCostPerHour: '360', maleCount: '2', maleWage: '45', lHours: '6', lDays: '2' }], -165),
      sowing: rec([{ date: day(-156), seedOrSapling: 'Sapling' }], -156),
      intercultivation: rec([{ date: day(-130), cropStage: 'Tillering', weeding: 'First weeding', method: 'Manual', area: '2.5', other: '600' }, { date: day(-110), cropStage: 'Tillering', weeding: 'Second weeding', method: 'Manual', area: '2.5', other: '600' }], -110),
      water: rec([{ date: day(-140), farmingType: 'Irrigated', cropStage: 'Vegetative', irrigationNo: '1', source: 'Canal', irrigationMethod: 'Flood irrigation', area: '2.5', time: '5', maleCount: '1', maleWage: '45', lHours: '5', lDays: '1' }], -140),
      nutrient: rec([{ date: day(-150), cropStage: 'Transplanting', applicationStage: 'Basal application', fertilizer: 'DAP', qty: '50', costPerKg: '27', area: '2.5', applicationMethod: 'Broadcasting' }], -150),
      pesticide: rec([{ date: day(-100), cropStage: 'Panicle initiation', pest: 'Stem borer', chemical: 'Chlorantraniliprole', qty: '0.15', costPerUnit: '5200', area: '2.5', applicationMethod: 'Backpack sprayer', maleCount: '1', maleWage: '45', lHours: '4', lDays: '1' }], -100),
      harvest: rec([{ date: day(-45), cropStage: 'Maturity', harvestNo: '1', area: '2.5', method: 'Mechanized', other: '3500' }], -45),
      transport: rec([{ date: day(-43), what: 'Paddy', weight: '5200', mode: 'Tractor', fuelType: 'Diesel', fuelCost: '92', economy: '6', distance: '18' }], -43),
    },
  },
  {
    id: 'c2',
    no: 2,
    farmerId: 'KU-F-10231',
    landId: 'l2',
    startedAt: daysFromNow(-30, 9),
    steps: {
      land_prep: rec([{ date: day(-30), prepType: 'Ploughing', machinery: 'Tractor', machineryStatus: 'Owned', hours: '5', days: '1', fuelPerHour: '4', fuelCostPerHour: '360' }], -30),
      sowing: rec([{ date: day(-19), seedOrSapling: 'Seed' }], -19),
    },
  },
];
