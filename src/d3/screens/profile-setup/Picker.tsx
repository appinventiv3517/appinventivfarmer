import { useId, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { Sheet } from '../../ui/Sheet';
import { SearchBox } from '../../ui/SearchBox';
import f from '../../ui/Field.module.css';
import s from './ProfileSetup.module.css';

export interface PickOption {
  value: string;
  label: string;
  sub?: ReactNode;
  /** Extra text matched by search (ID, phone…). */
  keywords?: string;
}

/**
 * A field that opens a bottom sheet of choices, with search for long lists.
 * Looks like the other Field Journal inputs; the sheet lists each choice with
 * a Select action, as in the sign-up designs.
 */
export function PickerField({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = 'Select',
  sheetTitle,
  sheetText,
  search,
  icon,
  error,
  hint,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: PickOption[];
  placeholder?: string;
  sheetTitle?: string;
  sheetText?: string;
  /** Placeholder for the search box; omit for short lists. */
  search?: string;
  icon?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return options;
    return options.filter((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(k));
  }, [q, options]);
  return (
    <div className={f.field}>
      <span className={f.label}>
        <span id={`${id}-l`}>
          {label}
          {required && (
            <span className={f.req} aria-hidden>
              {' '}*
            </span>
          )}
        </span>
      </span>
      <button
        type="button"
        className={`${f.box} ${s.trigger} ${error ? f.invalid : ''}`}
        onClick={() => {
          setQ('');
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-labelledby={`${id}-l ${id}-v`}
        aria-describedby={error || hint ? `${id}-m` : undefined}
        aria-invalid={!!error || undefined}
      >
        {icon && <span className={s.triggerIcon}>{icon}</span>}
        <span id={`${id}-v`} className={current ? s.triggerValue : s.triggerPlaceholder}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown className={f.chev} aria-hidden />
      </button>
      {error ? (
        <p id={`${id}-m`} className={f.error} role="alert">
          <AlertCircle aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-m`} className={f.hint}>
          {hint}
        </p>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? label} description={sheetText}>
        <div className={s.pickBody}>
          {search && <SearchBox value={q} onChange={setQ} placeholder={search} label={search} />}
          <ul className={s.pickList}>
            {list.map((o) => {
              const selected = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    className={`${s.pickRow} ${selected ? s.pickRowOn : ''}`}
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className={s.pickText}>
                      <span className={s.pickLabel}>{o.label}</span>
                      {o.sub && <span className={s.pickSub}>{o.sub}</span>}
                    </span>
                    <span className={s.pickAction} aria-hidden>
                      {selected ? (
                        <>
                          <Check /> Selected
                        </>
                      ) : (
                        'Select'
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li className={s.pickEmpty}>No match for “{q}”.</li>}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
