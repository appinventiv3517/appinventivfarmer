import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock, History, Play, Save, Send, ShieldCheck } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/format';
import { Counter } from '@/d3/ui/Controls';
import { TextArea } from '@/d3/ui/Field';
import { Sheet } from '@/d3/ui/Sheet';
import { useToast } from '@/d3/ui/Toast';
import { SPRING_SOFT } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Note, StatusTag } from '../../ui/Blocks';
import { Facts, Ring, Section } from '../../ui/Kit';
import { didi, useDidi } from '../../store';
import { STATUS_LABEL, STATUS_TONE, progressOf, type Proof } from '../../data/tasks';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { dueLabel } from './TaskCard';
import { ProofPicker } from './ProofPicker';
import s from './Tasks.module.css';

export default function TaskDetail() {
  const { id = '' } = useParams();
  const task = useDidi((st) => st.tasks.find((t) => t.id === id));
  const nav = useNav();
  const toast = useToast();
  const [done, setDone] = useState(task?.done ?? 0);
  const [note, setNote] = useState(task?.draftNote ?? '');
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  if (!task) return <Navigate to={to('/tasks')} replace />;

  const editable = task.status === 'in_progress' || task.status === 'rejected';
  const pct = progressOf({ done, target: task.target });
  const last = [...task.submissions].reverse().find((x) => x.kind === 'review');
  const changed = done !== task.done || note.trim() !== '' || proofs.length > 0;

  const save = async () => {
    if (!changed) return toast({ message: 'Nothing new to save. Update the count, add a note or a proof.', tone: 'info' });
    setBusy('save');
    await new Promise((r) => setTimeout(r, 600));
    didi.saveProgress(task.id, done, note.trim(), proofs);
    setBusy(null);
    setNote('');
    setProofs([]);
    toast({ message: 'Progress saved', tone: 'success' });
  };
  const askSubmit = () => {
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

  const footer = task.status === 'pending' ? (
    <Button size="lg" block icon={<Play aria-hidden />} onClick={() => (didi.startTask(task.id), toast({ message: 'Task started. It’s now in Ongoing.', tone: 'success' }))}>
      Start task
    </Button>
  ) : editable ? (
    <div className={s.footRow}>
      <Button size="lg" variant="secondary" icon={<Save aria-hidden />} onClick={save} loading={busy === 'save'}>
        Save
      </Button>
      <Button size="lg" block icon={<Send aria-hidden />} onClick={askSubmit} disabled={done === 0}>
        {task.status === 'rejected' ? 'Resubmit' : 'Submit'}
      </Button>
    </div>
  ) : undefined;

  return (
    <Screen title={task.title} backTo="/tasks" footer={footer}>
      <PageTitle kicker={`${task.category} · ${task.id}`} title={task.title} deck={task.summary} />
      <div className={s.detail}>
        <motion.div className={s.statusCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
          <Ring value={pct} size={88} stroke={8} label={`${pct}% of target done`} tone={task.status === 'approved' ? 'green' : 'clay'} />
          <div className={s.statusText}>
            <StatusTag tone={STATUS_TONE[task.status]} size="lg">
              {STATUS_LABEL[task.status]}
            </StatusTag>
            <strong className="didi-num">
              {done} of {task.target} {task.unit}
            </strong>
            <span>{task.status === 'approved' || task.status === 'lapsed' ? `Closed · due was ${formatDate(task.dueOn, 'short')}` : dueLabel(task.dueOn)}</span>
          </div>
        </motion.div>

        {task.status === 'rejected' && last && (
          <Note tone="danger" icon={<AlertTriangle aria-hidden />} title="Returned for changes">
            “{last.adminComment}” — {task.assignedBy}
          </Note>
        )}
        {task.status === 'in_review' && (
          <Note tone="warning" icon={<Clock aria-hidden />} title="Waiting for review">
            Submitted {last ? formatDateTime(last.at) : ''}. You’ll get a notification when it’s reviewed.
          </Note>
        )}
        {task.status === 'approved' && last && (
          <Note tone="success" icon={<ShieldCheck aria-hidden />} title={last.score !== undefined ? `Approved · score ${last.score} / 10` : 'Approved'}>
            {last.adminComment}
          </Note>
        )}
        {task.status === 'lapsed' && (
          <Note tone="neutral" icon={<Clock aria-hidden />} title="Lapsed">
            The due date passed before this task was submitted.
          </Note>
        )}

        <Section title="Task details" id="td">
          <p className={s.description}>{task.description}</p>
          <Facts
            items={[
              { label: 'Assigned on', value: formatDate(task.assignedOn, 'medium') },
              { label: 'Due on', value: formatDate(task.dueOn, 'medium') },
              { label: 'Target', value: `${task.target} ${task.unit}` },
              { label: 'Target completed', value: `${task.done} ${task.unit}` },
              { label: 'Assigned by', value: task.assignedBy },
            ]}
          />
        </Section>

        {editable && (
          <Section title="Update progress" id="up">
            <div className={s.counterRow}>
              <span>
                <strong>Target completed</strong>
                <small>
                  {task.unit} done so far, of {task.target}
                </small>
              </span>
              <Counter value={done} onChange={setDone} label={task.unit} max={task.target} />
            </div>
            <TextArea label="Notes" placeholder="What did you do? Anything the reviewer should know?" value={note} maxLength={300} onChange={(e) => (setNote(e.target.value), setNoteErr(null))} error={noteErr} />
            <div>
              <p className={s.fieldLabel}>Proof</p>
              <ProofPicker value={proofs} onChange={setProofs} />
            </div>
          </Section>
        )}

        <Section title="Progress history" id="ph">
          <Link to={to(`/tasks/${task.id}/history`)} className={s.historyLink}>
            <History aria-hidden />
            <span>
              <strong>Submissions and feedback</strong>
              <small>{task.submissions.length ? `${task.submissions.length} ${task.submissions.length === 1 ? 'update' : 'updates'} · last ${formatDate(task.submissions[task.submissions.length - 1].at, 'short')}` : 'No updates yet'}</small>
            </span>
          </Link>
        </Section>
      </div>

      <Sheet
        open={confirm}
        onClose={() => (setConfirm(false), sent && setSent(false))}
        variant="dialog"
        icon={sent ? <CheckCircle2 aria-hidden /> : <Send aria-hidden />}
        tone={sent ? 'success' : 'neutral'}
        title={sent ? 'Submitted for review' : 'Submit for review?'}
        description={
          sent
            ? 'Kisani Urjaa will review your work. You’ll get a notification with the result.'
            : `You’re reporting ${done} of ${task.target} ${task.unit}${proofs.length ? ` with ${proofs.length} proof ${proofs.length === 1 ? 'file' : 'files'}` : ', with no proof attached'}. You can’t edit it while it’s in review.`
        }
        footer={
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
                <Button block onClick={() => (setConfirm(false), setSent(false), nav('/tasks?tab=ongoing', { replace: true }))}>
                  Back to my tasks
                </Button>
              </motion.div>
            ) : (
              <motion.div key="ask" className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
                <Button block onClick={submit} loading={busy === 'submit'}>
                  Submit
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
