import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, RotateCcw, Save, Send } from 'lucide-react';
import { Counter } from '@/d3/ui/Controls';
import { TextArea } from '@/d3/ui/Field';
import { Sheet } from '@/d3/ui/Sheet';
import { useToast } from '@/d3/ui/Toast';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, Note } from '../../ui/Blocks';
import { Bar, Section } from '../../ui/Kit';
import { SuccessMark } from '../../ui/SuccessMark';
import { didi, useDidi } from '../../store';
import { STATUS_LABEL, actionsFor, lastReview, progressOf, type Proof } from '../../data/tasks';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { ProofPicker } from './ProofPicker';
import s from './Tasks.module.css';

/**
 * Add progress to an in-progress task, or rework a rejected one and resubmit.
 * Save progress keeps the task open; Submit sends it to Kisani Urjaa for approval.
 */
export default function AddProgress() {
  const { id = '' } = useParams();
  const task = useDidi((st) => st.tasks.find((t) => t.id === id));
  const nav = useNav();
  const toast = useToast();
  const [done, setDone] = useState(task?.done ?? 0);
  const [note, setNote] = useState(task?.draftNote ?? '');
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(false);
  if (!task) return <Navigate to={to("/tasks")} replace />;

  const act = actionsFor(task.status);
  const resubmit = act.resubmit;
  if (!act.addProgress && !resubmit && !sent)
    return (
      <Screen title="Add progress" backTo={`/tasks/${task.id}`}>
        <EmptyState animation="records" title="Progress can’t be added now" body={`This task is ${STATUS_LABEL[task.status].toLowerCase()}. ${task.status === 'pending' ? 'Start it first.' : 'There’s nothing to update.'}`} action={<Button to={`/tasks/${task.id}`}>Back to task</Button>} />
      </Screen>
    );

  const review = lastReview(task);
  const pct = progressOf({ done, target: task.target });
  const changed = done !== task.done || note.trim() !== '' || proofs.length > 0;

  const save = async () => {
    if (!changed) return toast({ message: 'Nothing new to save. Update the count, add a note or a file.', tone: 'info' });
    setBusy('save');
    await new Promise((r) => setTimeout(r, 600));
    didi.saveProgress(task.id, done, note.trim(), proofs);
    setBusy(null);
    toast({ message: 'Progress saved', tone: 'success' });
    nav(`/tasks/${task.id}`, { replace: true });
  };
  const askSubmit = () => {
    if (done === 0) return toast({ message: 'Add the target completed before submitting.', tone: 'info' });
    if (!note.trim()) return setNoteErr('Add a short note on what you did, for the reviewer.');
    setConfirm(true);
  };
  const submit = async () => {
    setBusy('submit');
    await new Promise((r) => setTimeout(r, 900));
    didi.submitForReview(task.id, done, note.trim(), proofs);
    setBusy(null);
    setSent(true);
  };

  return (
    <Screen
      title={resubmit ? 'Resubmit task' : 'Add progress'}
      backTo={`/tasks/${task.id}`}
      footer={
        <div className={s.footRow}>
          <Button size="lg" variant="secondary" icon={<Save aria-hidden />} onClick={save} loading={busy === 'save'} aria-label="Save progress" />
          <Button size="lg" block icon={resubmit ? <RotateCcw aria-hidden /> : <Send aria-hidden />} onClick={askSubmit}>
            {resubmit ? 'Resubmit' : 'Submit for approval'}
          </Button>
        </div>
      }
    >
      <PageTitle kicker={`${task.id} · ${task.category}`} title={resubmit ? 'Resubmit task' : 'Add progress'} deck={task.title} />
      <div className={s.detail}>
        {resubmit && review?.adminComment && (
          <Note tone="danger" icon={<AlertTriangle aria-hidden />} title="What to fix">
            “{review.adminComment}”
          </Note>
        )}

        <Section title="Target completed" id="tc">
          <div className={s.counterRow}>
            <span>
              <strong className="didi-num">
                {done} of {task.target} {task.unit}
              </strong>
              <small>Total done so far, including earlier updates.</small>
            </span>
            <Counter value={done} onChange={setDone} label={task.unit} max={task.target} />
          </div>
          <div className={s.liveBar}>
            <Bar value={pct} label={`${pct}% of target`} tone={pct === 100 ? 'green' : 'clay'} />
            <span className="didi-num">{pct}%</span>
          </div>
        </Section>

        <Section title="Progress notes" id="pn">
          <TextArea label="Notes" placeholder={resubmit ? 'What did you change since it was returned?' : 'What did you do? Anything the reviewer should know?'} value={note} maxLength={300} onChange={(e) => (setNote(e.target.value), setNoteErr(null))} error={noteErr} />
        </Section>

        <Section title="Photos, videos and documents" id="pf">
          <p className={s.fieldHint}>Add proof of the work. Photos are resized on this phone; each file can be up to 10 MB. Tap × to remove a file before you submit.</p>
          <ProofPicker value={proofs} onChange={setProofs} />
        </Section>
      </div>

      <Sheet
        open={confirm}
        onClose={() => (sent ? nav(`/tasks/${task.id}`, { replace: true }) : setConfirm(false))}
        variant="dialog"
        icon={sent ? undefined : resubmit ? <RotateCcw aria-hidden /> : <Send aria-hidden />}
        tone={sent ? 'success' : 'neutral'}
        title={sent ? (resubmit ? 'Resubmitted' : 'Submitted for approval') : resubmit ? 'Resubmit for approval?' : 'Submit for approval?'}
        description={
          sent
            ? 'Kisani Urjaa will review it. You’ll get a notification with the result.'
            : `You’re reporting ${done} of ${task.target} ${task.unit}${proofs.length ? ` with ${proofs.length} ${proofs.length === 1 ? 'file' : 'files'}` : ', with no files attached'}. You can’t change it while it’s in review.`
        }
        footer={
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
                <div className={s.sentMark}>
                  <SuccessMark size={72} label="Sent" />
                </div>
                <Button block onClick={() => nav(`/tasks/${task.id}`, { replace: true })}>
                  View task
                </Button>
                <Button block variant="ghost" onClick={() => nav('/tasks?tab=progress', { replace: true })}>
                  Back to my tasks
                </Button>
              </motion.div>
            ) : (
              <motion.div key="ask" className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
                <Button block onClick={submit} loading={busy === 'submit'}>
                  {resubmit ? 'Resubmit' : 'Submit'}
                </Button>
                <Button block variant="ghost" onClick={() => setConfirm(false)}>
                  Keep editing
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        }
      />
    </Screen>
  );
}
