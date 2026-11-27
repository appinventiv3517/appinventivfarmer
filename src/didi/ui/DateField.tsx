import { useEffect, useId, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet } from '@/d3/ui/Sheet';
import fs from '@/d3/ui/Field.module.css';
import cal from '@/d3/ui/DateRange.module.css';
import { formatDate } from '@/lib/format';
import { isoDay } from '../data/dates';
import { Button } from './Button';
import s from './DateField.module.css';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEK_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function cells(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const out: (Date | null)[] = Array((first.getDay() + 6) % 7).fill(null);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (out.length % 7) out.push(null);
  return out;
}
const parse = (v?: string) => (v ? new Date(`${v}T00:00`) : null);

/**
 * Date input with the app's own calendar (the Ver 3 calendar style) in a
 * bottom sheet, instead of the browser's picker. Values are yyyy-mm-dd.
 */
export function DateField({ label, value, onChange, min, max, required, optional, error, placeholder = 'Pick a date', clearable }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string; required?: boolean; optional?: boolean; error?: string | null; placeholder?: string; clearable?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'years'>('days');
  const [month, setMonth] = useState(() => {
    const d = parse(value) ?? parse(max) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  useEffect(() => {
    if (!open) return;
    const d = parse(value) ?? (max && parse(max)! < new Date() ? parse(max)! : new Date());
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setView('days');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const grid = useMemo(() => cells(month), [month]);
  const today = isoDay(new Date());
  const off = (d: Date) => (min && isoDay(d) < min) || (max && isoDay(d) > max);
  const minY = min ? +min.slice(0, 4) : new Date().getFullYear() - 100;
  const maxY = max ? +max.slice(0, 4) : new Date().getFullYear() + 5;
  const years = Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i);
  const prevOff = !!min && isoDay(new Date(month.getFullYear(), month.getMonth(), 0)) < min;
  const nextOff = !!max && isoDay(new Date(month.getFullYear(), month.getMonth() + 1, 1)) > max;

  return (
    <div className={fs.field}>
      <span className={fs.label} id={`${id}-l`}>
        <span>
          {label}
          {required && (
            <span className={fs.req} aria-hidden>
              {' '}*
            </span>
          )}
        </span>
        {optional && <span className={fs.optional}> Optional</span>}
      </span>
      <button type="button" className={`${fs.box} ${s.trigger} ${error ? fs.invalid : ''}`} onClick={() => setOpen(true)} aria-labelledby={`${id}-l ${id}-v`} aria-haspopup="dialog">
        <CalendarDays className={s.icon} aria-hidden />
        <span id={`${id}-v`} className={`${s.value} ${value ? '' : s.placeholder}`}>
          {value ? formatDate(`${value}T00:00`, 'medium') : placeholder}
        </span>
      </button>
      {error && (
        <p className={fs.error} role="alert">
          <AlertCircle aria-hidden /> {error}
        </p>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        kicker={label}
        title={value ? formatDate(`${value}T00:00`, 'long') : 'Pick a date'}
        footer={
          <div className={s.foot}>
            {clearable && value ? (
              <Button variant="secondary" onClick={() => (onChange(''), setOpen(false))}>
                Clear
              </Button>
            ) : (
              <span />
            )}
            {!off(new Date()) && (
              <Button variant="secondary" onClick={() => (onChange(today), setOpen(false))}>
                Today
              </Button>
            )}
          </div>
        }
      >
        <div className={cal.cal}>
          <div className={cal.head}>
            <button type="button" className={s.monthBtn} onClick={() => setView(view === 'days' ? 'years' : 'days')} aria-expanded={view === 'years'} aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}. Choose month and year`}>
              <span className={cal.month}>
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </span>
              <ChevronDown aria-hidden className={view === 'years' ? s.flip : ''} />
            </button>
            {view === 'days' && (
              <div className={cal.navs}>
                <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" disabled={prevOff}>
                  <ChevronLeft aria-hidden />
                </button>
                <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" disabled={nextOff}>
                  <ChevronRight aria-hidden />
                </button>
              </div>
            )}
          </div>
          {view === 'years' ? (
            <div className={s.pickers}>
              <div className={s.months} role="group" aria-label="Month">
                {MONTHS.map((m, i) => (
                  <button key={m} type="button" className={`${s.cell} ${i === month.getMonth() ? s.cellOn : ''}`} onClick={() => setMonth(new Date(month.getFullYear(), i, 1))}>
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
              <div className={s.years} role="group" aria-label="Year">
                {years.map((y) => (
                  <button key={y} type="button" className={`${s.cell} ${y === month.getFullYear() ? s.cellOn : ''}`} onClick={() => (setMonth(new Date(y, month.getMonth(), 1)), setView('days'))}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={cal.grid} role="grid" aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}>
              {WEEK.map((w, i) => (
                <span key={i} className={cal.wd} role="columnheader" aria-label={WEEK_LONG[i]}>
                  {w}
                </span>
              ))}
              {grid.map((d, i) => {
                if (!d) return <span key={i} />;
                const iso = isoDay(d);
                const on = iso === value;
                return (
                  <button key={i} type="button" role="gridcell" className={[cal.day, on ? `${cal.start} ${cal.solo}` : '', iso === today ? cal.today : ''].join(' ')} disabled={!!off(d)} aria-pressed={on} aria-label={formatDate(d, 'long')} onClick={() => (onChange(iso), setOpen(false))}>
                    {on && <span className={cal.pickBg} />}
                    <span className={cal.dayNum}>{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
