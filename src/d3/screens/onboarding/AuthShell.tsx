import type { FormEvent, ReactNode } from 'react';
import { useStatusTone } from '@/lib/statusTone';
import markUrl from '@/assets/brand/kisani-urjaa-mark.webp';
import { Photo } from '../../photo/Photo';
import { BackButton } from '../../ui/BackButton';
import { useNav } from '../../nav';
import s from './Onboarding.module.css';

/**
 * Ver 3 sign-up and log-in screens: a field photo with the brand lockup on a
 * paper wash, and the form on the ivory sheet below. Every screen in the flow
 * uses this frame, so steps feel like pages of one journal.
 */
export function AuthShell({
  title,
  text,
  photo = 'paddy-transplant',
  back,
  close,
  onSubmit,
  children,
}: {
  title: string;
  text?: ReactNode;
  photo?: string;
  /** Path for the back arrow, or -1 for history back. */
  back?: string | number;
  /** Path for a close (×) button instead of back. */
  close?: string;
  onSubmit?: (e: FormEvent) => void;
  children: ReactNode;
}) {
  const nav = useNav();
  useStatusTone('light');
  const Body = onSubmit ? 'form' : 'div';
  return (
    <div className={s.split}>
      <div className={`${s.splitPhoto} ${s.splitShort}`}>
        <Photo id={photo} ratio="fill" shade="full" drift priority label="hero" />
        {back !== undefined && <BackButton tone="image" className={s.splitBack} onClick={() => nav(back as string)} />}
        {close && <BackButton tone="image" close className={s.splitBack} onClick={() => nav(close, { replace: true })} />}
        <div className={s.splitBrand}>
          <span className={s.plate}>
            <img src={markUrl} alt="" />
          </span>
          <span className={s.brandName}>
            Kisani Urjaa
            <small>From waste to wealth</small>
          </span>
        </div>
      </div>
      <Body className={s.splitPanel} {...(onSubmit ? { onSubmit, noValidate: true } : {})}>
        <div className={s.panelBody}>
          <div>
            <h1 className={s.panelTitle}>{title}</h1>
            {text && <p className={s.panelText}>{text}</p>}
          </div>
          {children}
        </div>
      </Body>
    </div>
  );
}
