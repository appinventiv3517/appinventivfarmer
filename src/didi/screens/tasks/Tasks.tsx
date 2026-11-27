import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { SectionTabs } from '@/d3/ui/Controls';
import { SWAP } from '@/d3/motion/tokens';
import { Cascade, Rise } from '@/d3/motion/Reveal';
import { Screen } from '../../layout/Screen';
import { EmptyState, ErrorState, SkelList } from '../../ui/Blocks';
import { useLoad } from '../../ui/Kit';
import { useDidi } from '../../store';
import { tasksIn, type TaskTab } from '../../data/tasks';
import { TaskCard } from './TaskCard';
import s from './Tasks.module.css';

const EMPTY: Record<TaskTab, { title: string; body: string }> = {
  new: { title: 'No new tasks', body: 'New tasks from Kisani Urjaa will appear here.' },
  ongoing: { title: 'Nothing in progress', body: 'Start a task from New to see it here.' },
  closed: { title: 'No closed tasks yet', body: 'Approved and lapsed tasks are kept here.' },
};

export default function Tasks() {
  const [params, setParams] = useSearchParams();
  const tab = (['new', 'ongoing', 'closed'].includes(params.get('tab') ?? '') ? params.get('tab') : 'new') as TaskTab;
  const tasks = useDidi((st) => st.tasks);
  const load = useLoad('tasks');
  const list = tasksIn(tasks, tab);
  return (
    <Screen title="My tasks" variant="masthead" tabRoot kicker="Kisani Didi" deck="Work assigned to you by Kisani Urjaa.">
      <div className={s.page}>
        <div className={s.tabs}>
          <SectionTabs
            label="Task status"
            value={tab}
            onChange={(v) => setParams(v === 'new' ? {} : { tab: v }, { replace: true })}
            items={[
              { value: 'new', label: 'New', count: tasksIn(tasks, 'new').length },
              { value: 'ongoing', label: 'Ongoing', count: tasksIn(tasks, 'ongoing').length },
              { value: 'closed', label: 'Closed', count: tasksIn(tasks, 'closed').length },
            ]}
          />
        </div>
        {load.status === 'loading' ? (
          <SkelList count={3} thumb={0} />
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} {...SWAP}>
              {list.length ? (
                <Cascade className={s.list}>
                  {list.map((t) => (
                    <Rise key={t.id}>
                      <TaskCard task={t} />
                    </Rise>
                  ))}
                </Cascade>
              ) : (
                <EmptyState animation="records" title={EMPTY[tab].title} body={EMPTY[tab].body} compact />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Screen>
  );
}
