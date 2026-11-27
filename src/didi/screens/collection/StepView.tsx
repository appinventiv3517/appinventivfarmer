import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Pencil } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/Blocks';
import { STEPS, shown, stepDef, type Ctx, type Entry, type StepDef } from '../../data/collection';
import { LandCropCard, ctxOf, useCycle } from './parts';
import s from './Collection.module.css';

/** Only the fields that were filled in, grouped as in the form. */
function EntryView({ step, e, ctx }: { step: StepDef; e: Entry; ctx: Ctx }) {
  const groups = step.sections.map((sec) => ({ title: sec.title, rows: sec.fields.map((f) => ({ f, v: shown(f, e, ctx) })).filter((r) => r.v !== null) })).filter((g) => g.rows.length);
  return (
    <>
      {groups.map((g) => (
        <section key={g.title} className={s.viewSection} aria-label={g.title}>
          <div className={s.viewHead}>
            <h3>{g.title}</h3>
            <small>
              {g.rows.length} {g.rows.length === 1 ? 'field' : 'fields'}
            </small>
          </div>
          <dl className={s.kv}>
            {g.rows.map(({ f, v }) => (
              <div key={f.key} className={f.kind === 'textarea' ? s.kvWide : ''}>
                <dt>{f.label}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}

export default function StepView() {
  const { id = '', cid = '', step: sk = '' } = useParams();
  const { f, cycle, land } = useCycle(id, cid);
  const step = stepDef(sk);
  const rec = step && cycle?.steps[step.key];
  const [open, setOpen] = useState(0);
  const back = f && cycle ? `/farmers/${f.id}/collection/${cycle.id}` : f ? `/farmers/${f.id}/collection` : '/farmers';
  if (!f || !cycle || !step || !rec)
    return (
      <Screen title="Form" backTo={back}>
        <EmptyState animation="records" title="Nothing submitted yet" body="This form hasn’t been filled in for this cycle." action={<Button to={back}>Back</Button>} />
      </Screen>
    );
  const ctx = ctxOf(land);
  const no = STEPS.findIndex((x) => x.key === step.key) + 1;
  return (
    <Screen
      title={step.title}
      backTo={back}
      footer={
        <Button size="lg" block variant="secondary" icon={<Pencil aria-hidden />} to={`${back}/${step.key}/edit`}>
          Edit
        </Button>
      }
    >
      <PageTitle kicker={`Step ${no} of ${STEPS.length} · Form cycle ${cycle.no}`} title={step.title} deck={`${f.name} · ${f.id}`} />
      <div className={s.page}>
        <div className={s.meta}>
          <div>
            Submitted on <strong>{formatDate(rec.submittedAt, 'medium')}</strong>
          </div>
          <div>
            Last updated by <strong>{rec.updatedBy}</strong>
          </div>
          <div>
            Last updated at <strong>{formatDate(rec.updatedAt, 'medium')}</strong>
          </div>
        </div>
        <LandCropCard f={f} land={land} />
        {step.repeatable && rec.entries.length > 1 ? (
          rec.entries.map((e, i) => (
            <div key={i} className={`${s.entry} ${open === i ? s.entryOpen : ''}`}>
              <div className={s.entryHead}>
                <button type="button" className={s.entryToggle} onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                  <span>
                    <strong>Form {i + 1}</strong> <small>{e.date ? `(${formatDate(`${e.date}T00:00`, 'medium')})` : ''}</small>
                  </span>
                  <ChevronDown aria-hidden />
                </button>
              </div>
              {open === i && (
                <div className={s.entryBody}>
                  <EntryView step={step} e={e} ctx={ctx} />
                </div>
              )}
            </div>
          ))
        ) : (
          <EntryView step={step} e={rec.entries[0]} ctx={ctx} />
        )}
      </div>
    </Screen>
  );
}
