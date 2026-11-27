import { useState } from 'react';
import { SearchBox } from '@/d3/ui/SearchBox';
import { Screen, PageTitle } from '../../layout/Screen';
import { Accordion, EmptyState } from '../../ui/Blocks';
import { Button } from '../../ui/Button';
import s from './Profile.module.css';

const FAQS = [
  { q: 'How do I start a task?', a: 'Open My tasks, choose a task in New and tap Start task. It moves to Ongoing, where you can save progress and submit it.' },
  { q: 'What counts as proof?', a: 'A clear photo, a short video or a file that shows the work, such as a photo of the farmer at the visit. Each file can be up to 10 MB.' },
  { q: 'My task was rejected. What now?', a: 'Open the task to read the reviewer’s comment, fix what they asked for, add new proof and tap Resubmit.' },
  { q: 'I forgot to check out. What happens?', a: 'You’ll see a notification. If your times are wrong, contact support with the date.' },
  { q: 'My QR code won’t scan.', a: 'Turn up your screen brightness and hold the phone steady. You can also read out your Partner ID, shown under the code.' },
  { q: 'How do I mark attendance?', a: 'Tap Check in on Home or Attendance, take a selfie and let the app capture your location. Do the same with Check out when you finish.' },
  { q: 'When are payments credited?', a: 'Kisani Urjaa makes and records payments. Each one shows as Pending until the transfer is confirmed. For a question, contact support with the reference number.' },
  { q: 'How is the leaderboard decided?', a: 'Kisani Urjaa sets points from reviewed tasks. The app shows the ranks it receives.' },
];

export default function Faqs() {
  const [q, setQ] = useState('');
  const list = FAQS.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Screen title="FAQs" backTo="/profile">
      <PageTitle title="FAQs" deck="Answers to common questions." />
      <div className={s.sub}>
        <div className={s.gutter}>
          <SearchBox value={q} onChange={setQ} placeholder="Search questions" />
        </div>
        <div className={s.gutter}>
          {list.length ? list.map((f, i) => (
            <Accordion key={f.q} title={f.q} defaultOpen={i === 0 && !q}>
              <p className={s.answer}>{f.a}</p>
            </Accordion>
          )) : <EmptyState animation="search" title="No matching questions" action={<Button variant="secondary" to="/profile/contact">Contact us</Button>} compact />}
        </div>
      </div>
    </Screen>
  );
}
