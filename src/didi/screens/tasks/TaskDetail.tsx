import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, ClipboardList, Clock, FlaskConical, History, Info, Play, Plus, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/format';
import { Sheet } from '@/d3/ui/Sheet';
import { useToast } from '@/d3/ui/Toast';
import { SPRING_SOFT } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Note, StatusTag } from '../../ui/Blocks';
import { Facts, Ring, Section } from '../../ui/Kit';
import { didi, useDidi } from '../../store';
import { STATUS_EXPLAIN, STATUS_LABEL, STATUS_TONE, actionsFor, completedOn, lastReview, progressOf, scoreOf } from '../../data/tasks';
import { to } from '../../paths';
import { IS_DEMO } from '../../demo';
import { dueLabel } from './TaskCard';
import s from './Tasks.module.css';

export default function TaskDetail() {
  const { id = '' } = useParams();
  const task = useDidi((st) => st.tasks.find((t) => t.id === id));
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  if (!task) return <Navigate to={to('/tasks')} replace />;

  const pct = progressOf(task);
  const act = actionsFor(task.status);
  const review = lastReview(task);
  const score = scoreOf(task);
  const done = completedOn(task);
  const waiting = task.status === 'in_review' || task.status === 'resubmitted';
  const sent = [...task.submissions].reverse().find((x) => x.kind === 'review');
  const closed = task.status === 'approved' || task.status === 'lapsed';

  const progressLink = `/tasks/${task.id}/history`;
  const footer = act.start ? (
    <Button size="lg" block icon={<Play aria-hidden />} onClick={() => setStarting(true)}>
      Start task
    </Button>
  ) : act.addProgress ? (
    <div className={s.footRow}>
      <Button size="lg" variant="secondary" icon={<History aria-hidden />} to={progressLink} aria-label="Progress details" />
      <Button size="lg" block icon={<Plus aria-hidden />} to={`/tasks/${task.id}/progress`}>
        Add progress
      </Button>
    </div>
  ) : act.resubmit ? (
    <div className={s.footRow}>
      <Button size="lg" variant="secondary" icon={<History aria-hidden />} to={progressLink} aria-label="Progress details" />
      <Button size="lg" block icon={<RotateCcw aria-hidden />} to={`/tasks/${task.id}/progress`}>
        Resubmit
      </Button>
    </div>
  ) : (
    <Button size="lg" block variant="secondary" icon={<History aria-hidden />} to={progressLink}>
      View progress details
    </Button>
  );

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
              {task.done} of {task.target} {task.unit}
            </strong>
            <span>{closed ? (done ? `Completed ${formatDate(done, 'medium')}` : `Due was ${formatDate(task.dueOn, 'medium')}`) : waiting ? `Due ${formatDate(task.dueOn, 'medium')}` : dueLabel(task.dueOn)}</span>
          </div>
        </motion.div>
        <p className={s.explain}>{STATUS_EXPLAIN[task.status]}</p>

        <div className={s.kpis}>
          <span>
            <small>{done ? 'Completed' : 'Due'}</small>
            <strong className="didi-num">{formatDate(done ?? task.dueOn, 'short')}</strong>
          </span>
          <span>
            <small>Score</small>
            <strong className="didi-num">{score !== undefined ? `${score} / 10` : '—'}</strong>
          </span>
          <span>
            <small>Updates</small>
            <strong className="didi-num">{task.submissions.length}</strong>
          </span>
        </div>

        {task.status === 'rejected' && review && (
          <Note tone="danger" icon={<AlertTriangle aria-hidden />} title="Rejected · returned for changes">
            “{review.adminComment}” — {task.assignedBy}
            {review.reviewedAt ? `, ${formatDate(review.reviewedAt, 'short')}` : ''}
          </Note>
        )}
        {waiting && (
          <Note tone="warning" icon={<Clock aria-hidden />} title={task.status === 'resubmitted' ? 'Resubmitted · waiting for review' : 'Waiting for review'}>
            {sent ? `Sent ${formatDateTime(sent.at)}. ` : ''}You’ll get a notification when Kisani Urjaa reviews it. You can’t change it meanwhile.
          </Note>
        )}
        {task.status === 'approved' && review && (
          <Note tone="success" icon={<ShieldCheck aria-hidden />} title={review.score !== undefined ? `Approved · score ${review.score} / 10` : 'Approved'}>
            {review.adminComment}
          </Note>
        )}
        {task.status === 'lapsed' && (
          <Note tone="neutral" icon={<Clock aria-hidden />} title="Lapsed">
            The due date passed before this task was submitted. It can’t be changed now.
          </Note>
        )}
        {task.adminNote && (
          <Note tone="info" icon={<Info aria-hidden />} title="Note from Kisani Urjaa">
            {task.adminNote}
          </Note>
        )}

        <Section title="Task details" id="td">
          <p className={s.description}>{task.description}</p>
          <Facts
            items={[
              { label: 'Assigned on', value: formatDate(task.assignedOn, 'medium') },
              { label: 'Due on', value: formatDate(task.dueOn, 'medium') },
              ...(done ? [{ label: 'Completed on', value: formatDate(done, 'medium') }] : []),
              { label: 'Total target', value: `${task.target} ${task.unit}` },
              { label: 'Target completed', value: `${task.done} ${task.unit} (${pct}%)` },
              { label: 'Score', value: score !== undefined ? `${score} / 10` : 'Not scored yet' },
              { label: 'Assigned by', value: task.assignedBy },
            ]}
          />
        </Section>

        <Section title="Progress" id="ph">
          <Link to={to(progressLink)} className={s.historyLink}>
            <ClipboardList aria-hidden />
            <span>
              <strong>Progress details</strong>
              <small>{task.submissions.length ? `${task.submissions.length} ${task.submissions.length === 1 ? 'update' : 'updates'} · last ${formatDate(task.submissions[task.submissions.length - 1].at, 'short')}` : 'No updates yet'}</small>
            </span>
          </Link>
        </Section>

        {IS_DEMO && waiting && (
          <div className={s.demoBox}>
            <p>
              <FlaskConical aria-hidden /> Prototype only: stand in for Kisani Urjaa’s review.
            </p>
            <div className={s.footRow}>
              <Button variant="secondary" icon={<X aria-hidden />} onClick={() => (didi.reviewTask(task.id, 'rejected', 5, 'Some proof photos are unclear. Retake them in daylight and resubmit.'), toast({ message: `${task.id} rejected (prototype)`, tone: 'info' }))}>
                Reject
              </Button>
              <Button block icon={<Check aria-hidden />} onClick={() => (didi.reviewTask(task.id, 'approved', 8, 'Good work. Approved.'), toast({ message: `${task.id} approved (prototype)`, tone: 'success' }))}>
                Approve
              </Button>
            </div>
          </div>
        )}
      </div>

      <Sheet
        open={starting}
        onClose={() => setStarting(false)}
        variant="dialog"
        icon={<Play aria-hidden />}
        title="Start this task?"
        description={`It moves to In progress, and you can add progress as you work. Due ${formatDate(task.dueOn, 'medium')}.`}
        footer={
          <div className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
            <Button block onClick={() => (didi.startTask(task.id), setStarting(false), toast({ message: 'Task started. It’s now in progress.', tone: 'success' }))}>
              Start task
            </Button>
            <Button block variant="ghost" onClick={() => setStarting(false)}>
              Not now
            </Button>
          </div>
        }
      />
    </Screen>
  );
}
