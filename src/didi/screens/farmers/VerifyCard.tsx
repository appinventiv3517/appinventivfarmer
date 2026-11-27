import { BadgeCheck, Check, Clock, FlaskConical, ShieldAlert, ShieldQuestion, X } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/d3/ui/Toast';
import { Button } from '../../ui/Button';
import { Note } from '../../ui/Blocks';
import { didi, useFarmerVerification } from '../../store';
import type { Farmer } from '../../data/farmers';
import { IS_DEMO } from '../../demo';
import s from './Farmers.module.css';

/** The farmer's verification state, with the next step for the Didi. */
export function VerifyCard({ f }: { f: Farmer }) {
  const v = useFarmerVerification(f)!;
  const toast = useToast();
  const doc = v.docType ? `${v.docType}${v.idLast4 ? ` ending ${v.idLast4}` : ''}` : '';
  if (v.status === 'verified')
    return (
      <Note tone="success" icon={<BadgeCheck aria-hidden />} title="Verified farmer">
        {doc}
        {v.decidedOn ? ` · verified on ${formatDate(v.decidedOn, 'medium')}` : ''}
      </Note>
    );
  if (v.status === 'pending')
    return (
      <div className={s.verifyStack}>
        <Note tone="warning" icon={<Clock aria-hidden />} title="Verification pending">
          {doc} sent{v.submittedOn ? ` on ${formatDate(v.submittedOn, 'medium')}` : ''}. Kisani Urjaa is checking the documents. You’ll get a notification with the result.
        </Note>
        {IS_DEMO && (
          <div className={s.demoBox}>
            <p>
              <FlaskConical aria-hidden /> Prototype only: stand in for Kisani Urjaa’s decision.
            </p>
            <div className={s.demoRow}>
              <Button variant="secondary" icon={<X aria-hidden />} onClick={() => (didi.decideFarmerVerification(f.id, 'failed', 'The ID photo is blurred and the number can’t be read. Upload a clear photo of the front and back.'), toast({ message: 'Verification failed (prototype)', tone: 'info' }))}>
                Fail
              </Button>
              <Button block icon={<Check aria-hidden />} onClick={() => (didi.decideFarmerVerification(f.id, 'verified'), toast({ message: `${f.name.split(' ')[0]} is verified (prototype)`, tone: 'success' }))}>
                Verify
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  if (v.status === 'failed')
    return (
      <Note tone="danger" icon={<ShieldAlert aria-hidden />} title="Verification failed" action={<Button size="sm" to={`/farmers/${f.id}/verify`}>Verify again</Button>}>
        {v.reason ?? 'Kisani Urjaa could not verify this farmer.'}
      </Note>
    );
  return (
    <Note tone="warning" icon={<ShieldQuestion aria-hidden />} title="Not verified yet" action={<Button size="sm" to={`/farmers/${f.id}/verify`}>Verify now</Button>}>
      Verify {f.name.split(' ')[0]}’s identity with an ID document, so Kisani Urjaa can confirm the profile.
    </Note>
  );
}
