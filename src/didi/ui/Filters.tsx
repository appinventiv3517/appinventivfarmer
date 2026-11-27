import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import { Sheet } from '@/d3/ui/Sheet';
import { Chip } from '@/d3/ui/Controls';
import { TextField } from '@/d3/ui/Field';
import { TAP } from '@/d3/motion/tokens';
import { isoDay } from '../data/dates';
import { Button } from './Button';
import s from './Filters.module.css';

/** The "Filters" button beside a search box. Shows how many filters are on. */
export function FilterButton({ count, onClick, compact }: { count: number; onClick: () => void; compact?: boolean }) {
  return (
    <motion.button type="button" whileTap={TAP} className={`${s.btn} ${compact ? s.btnCompact : ''} ${count ? s.btnOn : ''}`} onClick={onClick} aria-label={count ? `Filters, ${count} on` : 'Filters'} aria-haspopup="dialog">
      <SlidersHorizontal aria-hidden />
      {!compact && <span>Filters</span>}
      {count > 0 && <span className={s.badge}>{count}</span>}
    </motion.button>
  );
}

/** Search box and Filters button on one line. */
export function SearchRow({ children }: { children: ReactNode }) {
  return <div className={s.row}>{children}</div>;
}

/** One group of choices in the filter sheet. Chips wrap instead of scrolling. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className={s.group}>
      <legend>{label}</legend>
      <div className={s.chips}>{children}</div>
    </fieldset>
  );
}

export function FilterChip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <Chip selected={on} onClick={onClick} count={count}>
      {children}
    </Chip>
  );
}

export type Range = { from?: string; to?: string };
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
};

/**
 * Date range: quick presets plus From and To dates. `past` presets look back
 * (registered, booked); `future` presets look ahead (due dates, visits).
 */
export function DateRangeGroup({ label, value, onChange, presets = 'past' }: { label: string; value: Range; onChange: (r: Range) => void; presets?: 'past' | 'future' | 'both' }) {
  const today = isoDay(new Date());
  const opts: { label: string; r: Range }[] = [
    ...(presets !== 'future' ? [{ label: 'Last 7 days', r: { from: shift(-6), to: today } }, { label: 'Last 30 days', r: { from: shift(-29), to: today } }] : []),
    ...(presets !== 'past' ? [{ label: 'Next 7 days', r: { from: today, to: shift(6) } }, { label: 'Next 30 days', r: { from: today, to: shift(29) } }] : []),
  ];
  const any = !value.from && !value.to;
  const bad = !!(value.from && value.to && value.from > value.to);
  return (
    <fieldset className={s.group}>
      <legend>{label}</legend>
      <div className={s.chips}>
        <Chip selected={any} onClick={() => onChange({})}>
          Any date
        </Chip>
        {opts.map((o) => (
          <Chip key={o.label} selected={value.from === o.r.from && value.to === o.r.to} onClick={() => onChange(o.r)}>
            {o.label}
          </Chip>
        ))}
      </div>
      <div className={s.dates}>
        <TextField label="From" type="date" value={value.from ?? ''} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value || undefined })} />
        <TextField label="To" type="date" value={value.to ?? ''} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value || undefined })} error={bad ? 'The end date is before the start date.' : null} />
      </div>
    </fieldset>
  );
}

/**
 * Bottom sheet for filters. It edits a draft copy; nothing changes on the
 * list until Apply. Clear resets the draft to `empty`.
 */
export function FilterSheet<T>({ open, onClose, title, value, empty, onApply, children, resultCount }: { open: boolean; onClose: () => void; title: string; value: T; empty: T; onApply: (v: T) => void; children: (draft: T, set: (v: T) => void) => ReactNode; resultCount?: (draft: T) => number }) {
  const [draft, setDraft] = useState<T>(value);
  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const n = resultCount?.(draft);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker="Filters"
      title={title}
      footer={
        <div className={s.foot}>
          <Button variant="secondary" size="lg" onClick={() => setDraft(empty)}>
            Clear
          </Button>
          <Button size="lg" block onClick={() => (onApply(draft), onClose())}>
            {n === undefined ? 'Apply filters' : n === 0 ? 'Apply · no results' : `Apply · ${n} ${n === 1 ? 'result' : 'results'}`}
          </Button>
        </div>
      }
    >
      <div className={s.body}>{children(draft, setDraft)}</div>
    </Sheet>
  );
}
