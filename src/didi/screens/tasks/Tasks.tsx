import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { SectionTabs } from '@/d3/ui/Controls';
import { SWAP } from '@/d3/motion/tokens';
import { Cascade, Rise } from '@/d3/motion/Reveal';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, SkelList } from '../../ui/Blocks';
import { useLoad } from '../../ui/Kit';
import { DateRangeGroup, FilterButton, FilterChip, FilterGroup, FilterSheet } from '../../ui/Filters';
import { useDidi } from '../../store';
import { STATUS_LABEL, TASK_TABS, tabOf, tasksIn, type Task, type TaskStatus, type TaskTab } from '../../data/tasks';
import { TaskCard } from './TaskCard';
import s from './Tasks.module.css';

const EMPTY: Record<TaskTab, { title: string; body: string }> = {
  pending: { title: 'No pending tasks', body: 'New tasks from Kisani Urjaa will appear here.' },
  progress: { title: 'Nothing in progress', body: 'Start a task from Pending to see it here.' },
  closed: { title: 'No closed tasks yet', body: 'Approved and lapsed tasks are kept here.' },
};

/** Statuses that can appear in each tab, for the filter sheet. */
const TAB_STATUSES: Record<TaskTab, TaskStatus[]> = {
  pending: ['pending'],
  progress: ['in_progress', 'in_review', 'rejected', 'resubmitted'],
  closed: ['approved', 'lapsed'],
};

type TaskFilters = { status: TaskStatus | 'all'; from?: string; to?: string };
const NONE: TaskFilters = { status: 'all' };

function applyFilters(list: Task[], f: TaskFilters): Task[] {
  return list.filter((t) => (f.status === 'all' || t.status === f.status) && (!f.from || t.dueOn.slice(0, 10) >= f.from) && (!f.to || t.dueOn.slice(0, 10) <= f.to));
}

export default function Tasks() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  // Old links (?tab=ongoing / new) still land on the right tab.
  const tab = (raw === 'ongoing' ? 'progress' : raw === 'new' ? 'pending' : TASK_TABS.some((x) => x.value === raw) ? raw : 'pending') as TaskTab;
  const all = useDidi((st) => st.tasks);
  const empty = useDidi((st) => st.demo.empty);
  const tasks = empty ? [] : all;
  const load = useLoad('tasks');
  const [filters, setFilters] = useState<TaskFilters>(NONE);
  const [open, setOpen] = useState(false);
  // A status filter only applies inside its own tab.
  const active: TaskFilters = filters.status !== 'all' && tabOf(filters.status) !== tab ? { ...filters, status: 'all' } : filters;
  const list = applyFilters(tasksIn(tasks, tab), active);
  const count = (active.status !== 'all' ? 1 : 0) + (active.from || active.to ? 1 : 0);

  return (
    <Screen title="My tasks" variant="masthead" tabRoot kicker="Kisani Didi" deck="Work assigned to you by Kisani Urjaa.">
      <div className={s.page}>
        <div className={s.tabs}>
          <SectionTabs label="Task status" value={tab} onChange={(v) => setParams(v === 'pending' ? {} : { tab: v }, { replace: true })} items={TASK_TABS.map((x) => ({ ...x, count: tasksIn(tasks, x.value).length }))} />
        </div>
        <div className={s.toolbar}>
          <p className={s.toolCount} aria-live="polite">
            {count ? `${list.length} of ${tasksIn(tasks, tab).length} shown` : `${list.length} ${list.length === 1 ? 'task' : 'tasks'}`}
          </p>
          <FilterButton count={count} onClick={() => setOpen(true)} />
        </div>
        {load.status === 'loading' ? (
          <SkelList count={3} thumb={0} />
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${tab}-${active.status}-${active.from}-${active.to}`} {...SWAP}>
              {list.length ? (
                <Cascade className={s.list}>
                  {list.map((t) => (
                    <Rise key={t.id}>
                      <TaskCard task={t} />
                    </Rise>
                  ))}
                </Cascade>
              ) : count ? (
                <EmptyState animation="search" title="No tasks match" body="Try another status or date range." action={<Button variant="secondary" onClick={() => setFilters(NONE)}>Clear filters</Button>} compact />
              ) : (
                <EmptyState animation="records" title={EMPTY[tab].title} body={EMPTY[tab].body} compact />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <FilterSheet open={open} onClose={() => setOpen(false)} title={`Filter ${TASK_TABS.find((x) => x.value === tab)!.label.toLowerCase()} tasks`} value={active} empty={NONE} onApply={setFilters} resultCount={(d) => applyFilters(tasksIn(tasks, tab), d).length}>
        {(d, set) => (
          <>
            {TAB_STATUSES[tab].length > 1 && (
              <FilterGroup label="Status">
                <FilterChip on={d.status === 'all'} onClick={() => set({ ...d, status: 'all' })}>
                  All
                </FilterChip>
                {TAB_STATUSES[tab].map((st) => (
                  <FilterChip key={st} on={d.status === st} onClick={() => set({ ...d, status: st })} count={tasksIn(tasks, tab).filter((t) => t.status === st).length}>
                    {STATUS_LABEL[st]}
                  </FilterChip>
                ))}
              </FilterGroup>
            )}
            <DateRangeGroup label="Due date" value={{ from: d.from, to: d.to }} onChange={(r) => set({ ...d, ...r, from: r.from, to: r.to })} presets={tab === 'closed' ? 'past' : 'both'} />
          </>
        )}
      </FilterSheet>
    </Screen>
  );
}
