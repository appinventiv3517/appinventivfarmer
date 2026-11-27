import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { LANGUAGE_CATALOG } from '@/services/store';
import { TAP } from '@/d3/motion/tokens';
import s from './Profile.module.css';

/** Every Kisani Urjaa language, as large tiles with the native name first. */
export function LanguageList({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <div className={s.langs} role="radiogroup" aria-label="App language">
      {LANGUAGE_CATALOG.map((l) => {
        const on = l.code === value;
        return (
          <motion.button key={l.code} type="button" role="radio" aria-checked={on} whileTap={TAP} className={`${s.lang} ${on ? s.langOn : ''}`} onClick={() => onChange(l.code)} lang={l.code}>
            <span className={s.mark}>{l.mark}</span>
            <span className={s.langText}>
              <strong>{l.native}</strong>
              <small>{l.english}</small>
            </span>
            {on && <Check aria-hidden className={s.check} />}
          </motion.button>
        );
      })}
    </div>
  );
}
