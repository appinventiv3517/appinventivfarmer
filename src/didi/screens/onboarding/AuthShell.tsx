import type { FormEvent, ReactNode } from 'react';
import { useStatusTone } from '@/lib/statusTone';
import markUrl from '@/assets/brand/kisani-urjaa-mark.webp';
import { Photo } from '@/d3/photo/Photo';
import { BackButton } from '@/d3/ui/BackButton';
import { useNav } from '../../nav';
import s from '@/d3/screens/onboarding/Onboarding.module.css';

/** The Farmer App's log-in frame: a field photo with the brand lockup, the form on the ivory sheet below. */
export function AuthShell({ title, text, photo = 'kisani-didi-meeting', back, onSubmit, children }: { title: string; text?: ReactNode; photo?: string; back?: string; onSubmit?: (e: FormEvent) => void; children: ReactNode }) {
  const nav = useNav();
  useStatusTone('light');
  const Body = onSubmit ? 'form' : 'div';
  return (
    <div className={s.split}>
      <div className={`${s.splitPhoto} ${s.splitShort}`}>
        <Photo id={photo} ratio="fill" shade="full" priority label="hero" />
        {back && <BackButton tone="image" className={s.splitBack} onClick={() => nav(back)} />}
        <div className={s.splitBrand}>
          <span className={s.plate}>
            <img src={markUrl} alt="" />
          </span>
          <span className={s.brandName}>
            Kisani Urjaa
            <small>Kisani Didi App</small>
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
