import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AlertTriangle, Award, CheckCircle2, MessageSquareText, Plus, RotateCcw, Save, Send, XCircle } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/format';
import { Sheet } from '@/d3/ui/Sheet';
import { Photo } from '@/d3/photo/Photo';
import { Cascade, Rise } from '@/d3/motion/Reveal';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, Note, StatusTag } from '../../ui/Blocks';
import { Facts, Section } from '../../ui/Kit';
import { useDidi } from '../../store';
import { STATUS_EXPLAIN, STATUS_LABEL, STATUS_TONE, actionsFor, completedOn, progressOf, type Proof, type Submission } from '../../data/tasks';
import { to } from '../../paths';
import { ProofTile } from './ProofPicker';
import s from './Tasks.module.css';

function eventTitle(x: Submission): string {
  if (x.kind === 'progress') return 'Progress saved';
  return x.resubmission ? 'Resubmitted for approval' : 'Submitted for approval';
}

/** Every update on a task, newest first, with proofs, scores and reviewer feedback. */
export default function TaskHistory() {
  const { id = '' } = useParams();
  const task = useDidi((st) => st.tasks.find((t) => t.id === id));
  const [view, setView] = useState<Proof | null>(null);
  if (!task) return <Navigate to={to('/tasks')} replace />;
  const subs = [...task.submissions].reverse();
  const scored = task.submissions.filter((x) => x.score !== undefined);
  const lastReview = subs.find((x) => x.outcome);
  const act = actionsFor(task.status);
  const done = completedOn(task);
  return (
    <Screen
      title="Progress details"
      backTo={`/tasks/${task.id}`}
      footer={
        act.resubmit ? (
          <Button size="lg" block icon={<RotateCcw aria-hidden />} to={`/tasks/${task.id}/progress`}>
            Resubmit rejected work
          </Button>
        ) : act.addProgress ? (
          <Button size="lg" block icon={<Plus aria-hidden />} to={`/tasks/${task.id}/progress`}>
            Add more progress
          </Button>
        ) : undefined
      }
    >
      <PageTitle kicker={task.id} title="Progress details" deck={task.title} />
      <div className={s.detail}>
        <Section title="Summary" id="cd">
          <Facts
            items={[
              { label: 'Status', value: <StatusTag tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</StatusTag> },
              { label: 'Target completed', value: `${task.done} of ${task.target} ${task.unit} (${progressOf(task)}%)` },
              { label: 'Submissions', value: String(task.submissions.filter((x) => x.kind === 'review').length) },
              { label: 'Score', value: scored.length ? `${scored[scored.length - 1].score} / 10` : 'Not scored yet' },
              ...(lastReview?.reviewedAt ? [{ label: 'Last reviewed', value: formatDateTime(lastReview.reviewedAt) }] : []),
              ...(done ? [{ label: 'Completed on', value: formatDateTime(done) }] : []),
            ]}
          />
          <p className={s.explain}>{STATUS_EXPLAIN[task.status]}</p>
        </Section>
        {task.status === 'rejected' && lastReview?.adminComment && (
          <Note tone="danger" icon={<AlertTriangle aria-hidden />} title="Rejection reason">
            {lastReview.adminComment}
          </Note>
        )}
        <Section title="Updates" id="up">
          {subs.length === 0 ? (
            <EmptyState animation="records" title="No updates yet" body="Saved progress and submissions will appear here." compact />
          ) : (
            <Cascade>
              <ol className={s.timeline}>
                {subs.map((x) => (
                  <Rise as="li" key={x.id} className={s.event}>
                    <span className={`${s.eventIcon} ${x.outcome === 'approved' ? s.evOk : x.outcome === 'rejected' ? s.evBad : x.kind === 'review' ? s.evSent : ''}`} aria-hidden>
                      {x.outcome === 'approved' ? <CheckCircle2 /> : x.outcome === 'rejected' ? <XCircle /> : x.kind === 'review' ? <Send /> : <Save />}
                    </span>
                    <div className={s.eventBody}>
                      <p className={s.eventTitle}>
                        {eventTitle(x)}
                        {x.outcome ? <StatusTag tone={x.outcome === 'approved' ? 'success' : 'danger'}>{x.outcome === 'approved' ? 'Approved' : 'Rejected'}</StatusTag> : x.kind === 'review' && !x.outcome && (task.status === 'in_review' || task.status === 'resubmitted') && x === subs.find((y) => y.kind === 'review') ? <StatusTag tone="warning">In review</StatusTag> : null}
                      </p>
                      <p className={s.eventMeta}>
                        {formatDateTime(x.at)} · {x.count} {task.unit}
                      </p>
                      {x.note && <p className={s.eventNote}>{x.note}</p>}
                      {x.proofs.length > 0 && (
                        <ul className={s.proofGrid}>
                          {x.proofs.map((p) => (
                            <li key={p.id}>
                              <button type="button" className={s.proofBtn} onClick={() => setView(p)} aria-label={`View ${p.name}`}>
                                <ProofTile proof={p} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(x.adminComment || x.score !== undefined) && (
                        <div className={`${s.feedback} ${x.outcome === 'rejected' ? s.feedbackBad : ''}`}>
                          <span className={s.feedbackHead}>{x.outcome === 'rejected' ? 'Rejection reason' : 'Admin remarks'}{x.reviewedAt ? ` · ${formatDate(x.reviewedAt, 'short')}` : ''}</span>
                          {x.score !== undefined && (
                            <span className={s.score}>
                              <Award aria-hidden /> Score {x.score} / 10
                            </span>
                          )}
                          {x.adminComment && (
                            <span>
                              <MessageSquareText aria-hidden /> {x.adminComment}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Rise>
                ))}
              </ol>
            </Cascade>
          )}
        </Section>
      </div>
      <Sheet open={!!view} onClose={() => setView(null)} kicker="Proof" title={view?.name ?? ''}>
        {view && (
          <div className={s.viewer}>
            {view.kind === 'photo' && view.url ? <img src={view.url} alt={view.name} /> : view.kind === 'photo' && view.slot ? <Photo id={view.slot} ratio="4/3" alt={view.name} /> : <p className={s.description}>This {view.kind} was uploaded as proof. Files open in the full app once it is connected to Kisani Urjaa’s servers.</p>}
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
