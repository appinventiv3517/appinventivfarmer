import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { to as d3 } from '../paths';
import s from '@/d3/ui/Button.module.css';
import { TAP, TAP_ICON } from '@/d3/motion/tokens';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'night' | 'glass';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'style'> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  /** In-app path (Direction 01-style paths are mapped to /d3). */
  to?: string;
  replace?: boolean;
  href?: string;
}

function Spinner() {
  return <span className={s.spinner} aria-hidden />;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', block, icon, iconRight, loading, to, replace, href, className, children, disabled, type = 'button', ...rest }, ref) {
  const cls = [s.btn, s[variant], s[size], block ? s.block : '', loading ? s.loading : '', className ?? ''].join(' ');
  const content = (
    <>
      {loading ? <Spinner /> : icon && <span className={s.icon}>{icon}</span>}
      {children && <span className={s.label}>{children}</span>}
      {iconRight && !loading && <span className={s.icon}>{iconRight}</span>}
    </>
  );
  if (to)
    return (
      <motion.span whileTap={TAP} className={block ? s.blockWrap : s.inlineWrap}>
        <Link to={d3(to)} replace={replace} className={cls} aria-label={rest['aria-label']} onClick={rest.onClick as never}>
          {content}
        </Link>
      </motion.span>
    );
  if (href)
    return (
      <motion.a whileTap={TAP} href={href} target="_blank" rel="noreferrer" className={cls} aria-label={rest['aria-label']}>
        {content}
      </motion.a>
    );
  return (
    <motion.button ref={ref} whileTap={disabled || loading ? undefined : { scale: 0.97 }} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </motion.button>
  );
});

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'style'> {
  label: string;
  variant?: 'plain' | 'surface' | 'night' | 'glass';
  badge?: number;
  to?: string;
  active?: boolean;
  children: ReactNode;
}

export function IconButton({ label, variant = 'surface', badge, to, active, className, children, ...rest }: IconButtonProps) {
  const cls = [s.iconBtn, s[`i_${variant}`], active ? s.iActive : '', className ?? ''].join(' ');
  const inner = (
    <>
      {children}
      {!!badge && (
        <span className={s.badge} aria-hidden>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </>
  );
  const fullLabel = badge ? `${label}, ${badge} new` : label;
  if (to)
    return (
      <Link to={d3(to)} className={cls} aria-label={fullLabel}>
        {inner}
      </Link>
    );
  return (
    <motion.button whileTap={TAP_ICON} type="button" className={cls} aria-label={fullLabel} aria-pressed={active} {...rest}>
      {inner}
    </motion.button>
  );
}
