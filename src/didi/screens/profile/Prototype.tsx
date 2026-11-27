import { BadgeCheck, RotateCcw } from 'lucide-react';
import { Switch } from '@/d3/ui/Controls';
import { useToast } from '@/d3/ui/Toast';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Note } from '../../ui/Blocks';
import { didi, useDidi } from '../../store';
import { useNav } from '../../nav';
import s from './Profile.module.css';

/** Reviewer tools: show the loading and error states, and finish reviews that would come from Kisani Urjaa. */
export default function Prototype() {
  const nav = useNav();
  const toast = useToast();
  const demo = useDidi((st) => st.demo);
  const v = useDidi((st) => st.verification);
  return (
    <Screen title="Prototype controls" backTo="/profile">
      <PageTitle title="Prototype controls" deck="For reviewers. Not part of the real app." />
      <div className={s.sub}>
        <div className={s.gutter}>
          <div className={s.switches}>
            <label className={s.switchRow}>
              <span>
                <strong>Slow network</strong>
                <small>Lists and profiles take 2 seconds to load, so you can see the skeletons.</small>
              </span>
              <Switch label="Slow network" checked={demo.slow} onChange={(slow) => didi.setDemo({ slow })} />
            </label>
            <label className={s.switchRow}>
              <span>
                <strong>Loading fails</strong>
                <small>Lists and profiles show their error state with Try again.</small>
              </span>
              <Switch label="Loading fails" checked={demo.fail} onChange={(fail) => didi.setDemo({ fail })} />
            </label>
            <label className={s.switchRow}>
              <span>
                <strong>Empty lists</strong>
                <small>Tasks, farmers and bookings show their empty states.</small>
              </span>
              <Switch label="Empty lists" checked={demo.empty} onChange={(empty) => didi.setDemo({ empty })} />
            </label>
          </div>
        </div>
        <div className={`${s.gutter} ${s.formView}`}>
          <Button block variant="secondary" icon={<BadgeCheck aria-hidden />} disabled={v.status !== 'submitted'} onClick={() => (didi.verifyNow(), toast({ message: 'Verification marked as approved', tone: 'success' }))}>
            Approve my verification
          </Button>
          <Button block variant="danger" icon={<RotateCcw aria-hidden />} onClick={() => (didi.resetAll(), nav('/', { replace: true }))}>
            Reset the whole prototype
          </Button>
          <Note tone="info">Reviews of tasks and farmer verifications can be finished from the task or farmer screen while they’re waiting (“Prototype only” box). Everything in this prototype is kept on this device only.</Note>
        </div>
      </div>
    </Screen>
  );
}
