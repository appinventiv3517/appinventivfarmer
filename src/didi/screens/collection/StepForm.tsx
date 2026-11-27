import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus, Send, Trash2 } from 'lucide-react';
import { TextArea, TextField } from '@/d3/ui/Field';
import { Sheet } from '@/d3/ui/Sheet';
import { useToast } from '@/d3/ui/Toast';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, Note } from '../../ui/Blocks';
import { ComputedField, PickField } from '../../ui/PickField';
import { didi, useDidi } from '../../store';
import { STEPS, missing, nextStep, shown, stepDef, type Entry, type FieldDef, type StepDef } from '../../data/collection';
import { farmerById } from '../../data/farmers';
import { useNav } from '../../nav';
import { LandCropCard, ctxOf } from './parts';
import s from './Collection.module.css';
import { DateField } from '../../ui/DateField';
import { isoDay } from '../../data/dates';

const today = () => isoDay(new Date());

function FieldInput({ f, e, set, err, ctx }: { f: FieldDef; e: Entry; set: (k: string, v: string) => void; err?: string | null; ctx: { sown?: string } }) {
  const v = e[f.key] ?? '';
  if (f.kind === 'computed') return <ComputedField label={f.unit && !f.money && !f.label.toLowerCase().includes(f.unit.toLowerCase()) ? `${f.label} (${f.unit})` : f.label} value={shown(f, e, ctx)} explain={f.explain} />;
  if (f.kind === 'select') return <PickField label={f.label} value={v} onChange={(x) => set(f.key, x)} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} placeholder={`Select ${f.label.toLowerCase()}`} required={f.required} error={err} />;
  if (f.kind === 'textarea') return <TextArea label={f.label} value={v} maxLength={500} placeholder="Enter recommendations" onChange={(x) => set(f.key, x.target.value)} />;
  if (f.kind === 'date') return <DateField label={f.label} required={f.required} value={v} max={today()} onChange={(x) => set(f.key, x)} error={err} />;
  if (f.kind === 'text') return <TextField label={f.label} value={v} placeholder={f.placeholder} onChange={(x) => set(f.key, x.target.value)} maxLength={80} />;
  const money = f.kind === 'money';
  const unit = f.unit && !f.label.toLowerCase().includes(f.unit.toLowerCase()) ? f.unit : undefined;
  return <TextField label={money ? `${f.label} (₹)` : unit ? `${f.label} (${unit})` : f.label} type="number" inputMode="decimal" min={0} step={money ? '0.01' : 'any'} placeholder={money ? '0.00' : '0'} prefix={money ? '₹' : undefined} value={v} onChange={(x) => set(f.key, x.target.value.replace(/^-/, ''))} />;
}

function EntryFields({ step, e, set, errs, ctx }: { step: StepDef; e: Entry; set: (k: string, v: string) => void; errs: Record<string, string>; ctx: { sown?: string } }) {
  return (
    <>
      {step.sections.map((sec) => (
        <section key={sec.title} className={s.formSection} aria-label={sec.title}>
          <h3>{sec.title}</h3>
          {sec.fields.map((f) => (
            <FieldInput key={f.key} f={f} e={e} set={set} err={errs[f.key]} ctx={ctx} />
          ))}
        </section>
      ))}
    </>
  );
}

/**
 * Fill in or edit one step. Steps go in order; a new cycle starts at Land
 * Preparation, where the plot (and so the crop) is chosen. Steps 3 to 8 can
 * hold several forms, e.g. one per irrigation.
 */
export default function StepForm() {
  const { id = '', cid = '', step: sk = '' } = useParams();
  const f = farmerById(id);
  const step = stepDef(sk);
  const isNew = cid === 'new';
  const cycle = useDidi((st) => st.collection.find((c) => c.id === cid && c.farmerId === f?.id));
  const open = useDidi((st) => st.collection.find((c) => c.farmerId === f?.id && STEPS.some((x) => !c.steps[x.key])));
  const toast = useToast();
  const nav = useNav();
  const existing = step && cycle?.steps[step.key]?.entries;
  const [entries, setEntries] = useState<Entry[]>(() => existing?.map((x) => ({ ...x })) ?? [{ date: today() }]);
  const [expanded, setExpanded] = useState(() => (existing ? existing.length - 1 : 0));
  const [landId, setLandId] = useState('');
  const [errs, setErrs] = useState<Record<number, Record<string, string>>>({});
  const [landErr, setLandErr] = useState<string | null>(null);
  const [del, setDel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const back = f ? (cycle ? `/farmers/${f.id}/collection/${cycle.id}` : `/farmers/${f.id}/collection`) : '/farmers';
  const blocked = !f || !step || (isNew ? step.key !== 'land_prep' || !!open : !cycle || (!cycle.steps[step.key] && nextStep(cycle) !== step.key));
  if (blocked)
    return (
      <Screen title="Data collection" backTo={back}>
        <EmptyState
          animation="records"
          title={!f ? 'Farmer not found' : isNew && open ? 'A form cycle is already in progress' : 'This form isn’t open yet'}
          body={isNew && open ? `Complete form cycle ${open.no} before starting a new one.` : 'Forms are filled in order. Finish the earlier steps first.'}
          action={<Button to={back}>Back</Button>}
        />
      </Screen>
    );

  const land = f!.lands.find((l) => l.id === (isNew ? landId : cycle!.landId));
  const ctx = ctxOf(land);
  const editing = !!existing;
  const set = (i: number) => (k: string, v: string) => {
    setEntries((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    setErrs((m) => ({ ...m, [i]: { ...(m[i] ?? {}), [k]: '' } }));
  };
  const add = () => {
    setEntries((xs) => [...xs, { date: today() }]);
    setExpanded(entries.length);
  };

  const submit = async () => {
    if (isNew && !landId) {
      setLandErr('Select the land for this form cycle.');
      window.scrollTo({ top: 0 });
      return;
    }
    const all: Record<number, Record<string, string>> = {};
    entries.forEach((e, i) => {
      const m = missing(step!, e);
      if (m.length) all[i] = Object.fromEntries(step!.sections.flatMap((x) => x.fields).filter((fd) => m.includes(fd.label)).map((fd) => [fd.key, `${fd.label} is required.`]));
    });
    setErrs(all);
    const firstBad = Object.keys(all).map(Number)[0];
    if (firstBad !== undefined) {
      setExpanded(firstBad);
      toast({ message: step!.repeatable && entries.length > 1 ? `Form ${firstBad + 1} has required fields left empty.` : 'Fill in the required fields.', tone: 'error' });
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    if (isNew) {
      const newId = didi.startCycle(f!.id, landId, entries);
      toast({ message: 'Form cycle started · Land Preparation submitted', tone: 'success' });
      nav(`/farmers/${f!.id}/collection/${newId}`, { replace: true });
    } else {
      didi.saveStep(cycle!.id, step!.key, entries);
      toast({ message: editing ? `${step!.title} updated` : `${step!.title} submitted`, tone: 'success' });
      nav(back, { replace: true });
    }
  };

  const no = STEPS.findIndex((x) => x.key === step!.key) + 1;
  return (
    <Screen
      title={step!.title}
      backTo={back}
      actions={
        step!.repeatable ? (
          <Button size="sm" variant="secondary" icon={<Plus aria-hidden />} onClick={add}>
            Add
          </Button>
        ) : undefined
      }
      footer={
        <Button size="lg" block icon={<Send aria-hidden />} onClick={submit} loading={busy}>
          {editing ? 'Save changes' : 'Submit'}
        </Button>
      }
    >
      <PageTitle kicker={`Step ${no} of ${STEPS.length} · ${isNew ? 'New form cycle' : `Form cycle ${cycle!.no}`}`} title={step!.title} deck={`${f!.name} · ${f!.id}`} />
      <div className={s.page}>
        {isNew ? (
          <section className={s.formSection} aria-label="Land and crop">
            <h3>Land and crop</h3>
            <PickField
              label="Select land"
              required
              searchable
              value={landId}
              onChange={(v) => (setLandId(v), setLandErr(null))}
              options={f!.lands.map((l) => ({ value: l.id, label: `${l.name} · ${l.areaAcres} acres`, meta: l.crop ? `${l.crop.name} · ${l.crop.season}` : 'No crop recorded' }))}
              emptyText="No land found"
              error={landErr}
            />
            <TextField label="Crop" readOnly value={land ? (land.crop ? `${land.crop.name} · ${land.crop.season} · ${land.areaAcres} acres` : 'No crop recorded on this land') : ''} placeholder="Chosen with the land" />
          </section>
        ) : (
          <LandCropCard f={f!} land={land} compact />
        )}

        {step!.repeatable ? (
          <>
            {entries.map((e, i) => {
              const isOpen = expanded === i;
              const hasErr = Object.values(errs[i] ?? {}).some(Boolean);
              return (
                <div key={i} className={`${s.entry} ${isOpen ? s.entryOpen : ''}`}>
                  <div className={s.entryHead}>
                    <button type="button" className={s.entryToggle} onClick={() => setExpanded(isOpen ? -1 : i)} aria-expanded={isOpen}>
                      <span>
                        <strong>Form {i + 1}</strong> <small>{e.date ? `(${shown({ key: 'date', label: '', kind: 'date' }, e, ctx)})` : ''}{hasErr ? ' · needs attention' : ''}</small>
                      </span>
                      <ChevronDown aria-hidden />
                    </button>
                    {entries.length > 1 && (
                      <button type="button" className={s.del} onClick={() => setDel(i)} aria-label={`Delete form ${i + 1}`}>
                        <Trash2 aria-hidden />
                      </button>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div className={s.entryBody} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                        <EntryFields step={step!} e={e} set={set(i)} errs={errs[i] ?? {}} ctx={ctx} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            <button type="button" className={s.addEntry} onClick={add}>
              <Plus aria-hidden /> Add another {step!.title.toLowerCase()} form
            </button>
          </>
        ) : (
          <EntryFields step={step!} e={entries[0]} set={set(0)} errs={errs[0] ?? {}} ctx={ctx} />
        )}
        {editing && <Note tone="info">Changes are saved to this form cycle and marked with your name and the time.</Note>}
      </div>

      <Sheet
        open={del !== null}
        onClose={() => setDel(null)}
        variant="dialog"
        tone="danger"
        icon={<Trash2 aria-hidden />}
        title="Delete form?"
        description={`Form ${(del ?? 0) + 1} will be removed when you ${editing ? 'save changes' : 'submit'}. This can’t be undone after that.`}
        footer={
          <div className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
            <Button
              block
              variant="danger"
              onClick={() => {
                const i = del!;
                setEntries((xs) => xs.filter((_, j) => j !== i));
                setErrs({});
                setExpanded(Math.max(0, i - 1));
                setDel(null);
                toast({ message: `Form ${i + 1} deleted`, tone: 'info' });
              }}
            >
              Delete
            </Button>
            <Button block variant="ghost" onClick={() => setDel(null)}>
              Cancel
            </Button>
          </div>
        }
      />
    </Screen>
  );
}
