import { useParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, StatusTag } from '../../ui/Blocks';
import { Section } from '../../ui/Kit';
import { STEPS, isComplete, nextStep, stepDef, submittedCount } from '../../data/collection';
import { CycleProgress, LandCropCard, useCycle } from './parts';
import s from './Collection.module.css';

/** One form cycle: land and crop, and each step with View and Edit. */
export default function CycleDetail() {
  const { id = '', cid = '' } = useParams();
  const { f, cycle, land } = useCycle(id, cid);
  if (!f || !cycle)
    return (
      <Screen title="Form cycle" backTo={f ? `/farmers/${f.id}/collection` : '/farmers'}>
        <EmptyState animation="search" title="Form cycle not found" body="It may have been removed from this device." action={<Button to={f ? `/farmers/${f.id}/collection` : '/farmers'}>Back</Button>} />
      </Screen>
    );
  const base = `/farmers/${f.id}/collection/${cycle.id}`;
  const nx = nextStep(cycle);
  return (
    <Screen
      title={`Form cycle ${cycle.no}`}
      backTo={`/farmers/${f.id}/collection`}
      footer={
        nx ? (
          <Button size="lg" block iconRight={<ArrowRight aria-hidden />} to={`${base}/${nx}/edit`}>
            Continue · {stepDef(nx)!.title}
          </Button>
        ) : undefined
      }
    >
      <PageTitle kicker={f.name} title={`Form cycle ${cycle.no}`} deck={`${submittedCount(cycle)} of ${STEPS.length} forms submitted`} />
      <div className={s.page}>
        <div className={s.cycle}>
          <CycleProgress cycle={cycle} />
        </div>
        <Section title="Land and crop" id="lc">
          <LandCropCard f={f} land={land} />
        </Section>
        <Section title={`Form steps · ${submittedCount(cycle)}/${STEPS.length}`} id="fs">
          <ol className={s.steps}>
            {STEPS.map((st, i) => {
              const r = cycle.steps[st.key];
              const cur = st.key === nx;
              return (
                <li key={st.key} className={`${s.step} ${r ? s.stepDone : cur ? s.stepCur : ''}`}>
                  <span className={s.dot}>{r ? <Check aria-hidden /> : i + 1}</span>
                  <div className={s.stepBody}>
                    <div className={s.stepTop}>
                      <strong>{st.title}</strong>
                      <StatusTag tone={r ? 'success' : cur ? 'warning' : 'neutral'}>{r ? 'Submitted' : cur ? 'Next step' : 'Pending'}</StatusTag>
                    </div>
                    {r && (
                      <>
                        <span className={s.stepMeta}>
                          Last updated by {r.updatedBy} · {formatDateTime(r.updatedAt)}
                          {st.repeatable ? ` · ${r.entries.length} ${r.entries.length === 1 ? 'form' : 'forms'}` : ''}
                        </span>
                        <div className={s.stepActions}>
                          <Button size="sm" variant="secondary" to={`${base}/${st.key}`}>
                            View
                          </Button>
                          <Button size="sm" variant="ghost" to={`${base}/${st.key}/edit`}>
                            Edit
                          </Button>
                        </div>
                      </>
                    )}
                    {cur && (
                      <div className={s.stepActions}>
                        <Button size="sm" to={`${base}/${st.key}/edit`}>
                          Fill in
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
        {isComplete(cycle) && <p className={s.nothing}>All {STEPS.length} forms are submitted. You can still view or edit any of them.</p>}
      </div>
    </Screen>
  );
}
