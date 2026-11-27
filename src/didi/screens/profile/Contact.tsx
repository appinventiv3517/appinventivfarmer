import { useState } from 'react';
import { Clock, Mail, MessageCircle, Phone, Send } from 'lucide-react';
import { SUPPORT } from '@/data/people';
import { TextArea } from '@/d3/ui/Field';
import { Chip, ChipRow } from '@/d3/ui/Controls';
import { useToast } from '@/d3/ui/Toast';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Row, RowGroup } from '../../ui/Blocks';
import s from './Profile.module.css';

const TOPICS = ['Tasks', 'Payments', 'Attendance', 'Farmers', 'App problem', 'Other'];

export default function Contact() {
  const toast = useToast();
  const [topic, setTopic] = useState('Tasks');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (msg.trim().length < 10) return setErr('Tell us a little more (at least 10 characters).');
    setBusy(true);
    await new Promise((r) => setTimeout(r, 800));
    setBusy(false);
    setMsg('');
    toast({ message: 'Message sent. Support will call you back.', tone: 'success' });
  };
  return (
    <Screen title="Contact us" backTo="/profile">
      <PageTitle title="Contact us" deck="The Kisani Urjaa support team for Kisani Didis." />
      <div className={s.sub}>
        <RowGroup>
          <Row icon={<Phone aria-hidden />} title="Call support" subtitle={SUPPORT.phoneLabel} onClick={() => (window.location.href = `tel:${SUPPORT.phone}`)} />
          <Row icon={<MessageCircle aria-hidden />} title="WhatsApp" subtitle="Message us any time" onClick={() => window.open(`https://wa.me/91${SUPPORT.whatsapp}`, '_blank')} />
          <Row icon={<Mail aria-hidden />} title="Email" subtitle={SUPPORT.email} onClick={() => (window.location.href = `mailto:${SUPPORT.email}`)} />
          <Row icon={<Clock aria-hidden />} title="Hours" subtitle={SUPPORT.hours} chevron={false} />
        </RowGroup>
        <div className={`${s.gutter} ${s.formView}`}>
          <p className={s.groupLabel}>Send a message</p>
          <ChipRow label="Topic">
            {TOPICS.map((t) => (
              <Chip key={t} selected={topic === t} onClick={() => setTopic(t)}>
                {t}
              </Chip>
            ))}
          </ChipRow>
          <TextArea label="Message" placeholder="What do you need help with?" maxLength={400} value={msg} onChange={(e) => (setMsg(e.target.value), setErr(null))} error={err} />
          <Button size="lg" block icon={<Send aria-hidden />} onClick={send} loading={busy}>
            Send
          </Button>
        </div>
      </div>
    </Screen>
  );
}
