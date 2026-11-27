import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarCheck2, CalendarClock, CalendarPlus, ChevronRight, Send } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { TAP } from '@/d3/motion/tokens';
import { StatusTag } from '../../ui/Blocks';
import { Bar } from '../../ui/Kit';
import { STATUS_LABEL, STATUS_TONE, completedOn, progressOf, type Task } from '../../data/tasks';
import { dayDiff } from '../../data/dates';
import { to } from '../../paths';
import s from './Tasks.module.css';

/** "Due today", "Due in 3 days", "2 days overdue", or the date. */
export function dueLabel(iso: string): string {
  const d = dayDiff(iso);
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  if (d > 1 && d <= 14) return `Due in ${d} days`;
  if (d < 0 && d >= -14) return `${-d} day${d === -1 ? '' : 's'} overdue`;
  return `Due ${formatDate(iso, 'short')}`;
}

export function TaskCard({ task }: { task: Task }) {
  const pct = progressOf(task);
  const closed = task.status === 'approved' || task.status === 'lapsed';
  const d = dayDiff(task.dueOn);
  const waiting = task.status === 'in_review' || task.status === 'resubmitted';
  const late = !closed && !waiting && d <= 2;
  const done = completedOn(task);
  const sentOn = waiting ? [...task.submissions].reverse().find((x) => x.kind === 'review')?.at : undefined;
  return (
    <motion.div whileTap={TAP}>
      <Link to={to(`/tasks/${task.id}`)} className={s.card}>
        <span className={s.cardTop}>
          <span className={s.category}>{task.category}</span>
          <StatusTag tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</StatusTag>
        </span>
        <strong className={s.title}>{task.title}</strong>
        <span className={s.summary}>{task.summary}</span>
        <span className={s.progressRow}>
          <Bar value={pct} label={`${pct}% done`} tone={task.status === 'approved' ? 'green' : task.status === 'rejected' || task.status === 'lapsed' ? 'warn' : 'clay'} />
          <span className={s.pct}>
            {task.done}/{task.target} {task.unit}
          </span>
        </span>
        <span className={s.dates}>
          <span>
            <CalendarPlus aria-hidden /> Assigned {formatDate(task.assignedOn, 'short')}
          </span>
          <span className={late ? s.late : ''}>
            <CalendarClock aria-hidden /> {closed || waiting ? `Due ${formatDate(task.dueOn, 'short')}` : dueLabel(task.dueOn)}
          </span>
          {done && (
            <span className={s.doneOn}>
              <CalendarCheck2 aria-hidden /> Completed {formatDate(done, 'short')}
            </span>
          )}
          {sentOn && (
            <span>
              <Send aria-hidden /> {task.status === 'resubmitted' ? 'Resubmitted' : 'Submitted'} {formatDate(sentOn, 'short')}
            </span>
          )}
          <ChevronRight aria-hidden className={s.chev} />
        </span>
      </Link>
    </motion.div>
  );
}
