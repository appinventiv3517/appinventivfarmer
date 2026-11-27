import { useId, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Info, Search } from 'lucide-react';
import { Sheet } from '@/d3/ui/Sheet';
import fs from '@/d3/ui/Field.module.css';
import { EmptyState } from './Blocks';
import s from './PickField.module.css';

export interface PickOption {
  value: string;
  label: string;
  meta?: string;
}

/**
 * A select that opens a bottom sheet of choices, each with a Select button
 * (as in the data-collection design). `searchable` adds a search box.
 */
export function PickField({ label, value, onChange, options, placeholder = 'Select', required, error, searchable, emptyText = 'Nothing to choose', disabled }: { label: string; value: string; onChange: (v: string) => void; options: PickOption[]; placeholder?: string; required?: boolean; error?: string | null; searchable?: boolean; emptyText?: string; disabled?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const list = q ? options.filter((o) => `${o.label} ${o.meta ?? ''}`.toLowerCase().includes(q.toLowerCase())) : options;
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
      </span>
      <button type="button" className={`${fs.box} ${s.trigger} ${error ? fs.invalid : ''}`} onClick={() => (setQ(''), setOpen(true))} aria-labelledby={`${id}-l ${id}-v`} aria-haspopup="dialog" disabled={disabled}>
        <span id={`${id}-v`} className={`${s.value} ${current ? '' : s.placeholder}`}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown className={fs.chev} aria-hidden />
      </button>
      {error && (
        <p className={fs.error} role="alert">
          <AlertCircle aria-hidden /> {error}
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className={s.sheet}>
          {searchable && (
            <label className={s.search}>
              <Search aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.replace(/^select /i, '').toLowerCase()}`} aria-label={`Search ${label.replace(/^select /i, '').toLowerCase()}`} />
            </label>
          )}
          {list.length === 0 ? (
            <EmptyState animation="pin" title={emptyText} compact />
          ) : (
            <ul className={s.list}>
              {list.map((o) => {
                const on = o.value === value;
                return (
                  <li key={o.value} className={s.row}>
                    <span className={s.rowText}>
                      <strong>{o.label}</strong>
                      {o.meta && <small>{o.meta}</small>}
                    </span>
                    <button type="button" className={`${s.pick} ${on ? s.pickOn : ''}`} onClick={() => (onChange(o.value), setOpen(false))} aria-pressed={on} aria-label={`${on ? 'Selected' : 'Select'} ${o.label}`}>
                      {on && <Check aria-hidden />}
                      {on ? 'Selected' : 'Select'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  );
}

/** A worked-out value: read-only, with an info button that says how it is calculated. */
export function ComputedField({ label, value, explain }: { label: string; value: string | null; explain?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className={fs.field}>
      <div className={fs.labelLine}>
        <span className={fs.label}>
          <span>{label}</span>
        </span>
        {explain && (
          <button type="button" className={s.info} onClick={() => setShow((x) => !x)} aria-expanded={show} aria-label={`How ${label.toLowerCase()} is worked out`}>
            <Info aria-hidden />
          </button>
        )}
      </div>
      <div className={`${fs.box} ${fs.readOnly} ${s.computed}`} aria-live="polite">
        <span className={`${s.value} ${value ? '' : s.placeholder}`}>{value ?? 'Worked out from the fields above'}</span>
      </div>
      {show && explain && <p className={fs.hint}>{explain}</p>}
    </div>
  );
}
