import { Navigate, useParams } from 'react-router-dom';
import { Copy, Headphones, Info } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useToast } from '@/d3/ui/Toast';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Note, StatusTag } from '../../ui/Blocks';
import { Facts, Section } from '../../ui/Kit';
import { TRANSACTIONS, TXN_STATUS } from '../../data/money';
import { to } from '../../paths';
import { useDidi } from '../../store';
import s from './Transactions.module.css';

export default function TransactionDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const t = TRANSACTIONS.find((x) => x.id === id);
  const task = useDidi((st) => st.tasks.find((k) => k.id === t?.relatedTask));
  if (!t) return <Navigate to={to('/transactions')} replace />;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.reference);
      toast({ message: 'Reference copied', tone: 'success' });
    } catch {
      toast({ message: `Reference: ${t.reference}`, tone: 'info' });
    }
  };
  return (
    <Screen title={t.title} backTo="/transactions" footer={<Button size="lg" block variant="secondary" icon={<Headphones aria-hidden />} to="/profile/contact">Ask about this payment</Button>}>
      <div className={s.detail}>
        <div className={s.hero}>
          <StatusTag tone={TXN_STATUS[t.status].tone} size="lg">
            {TXN_STATUS[t.status].label}
          </StatusTag>
          <strong className={`${s.big} ${t.status === 'failed' ? s.struck : ''}`}>{formatCurrency(t.amount)}</strong>
          <span>{t.title}</span>
        </div>
        {t.note && (
          <Note tone={t.status === 'failed' ? 'danger' : 'warning'} icon={<Info aria-hidden />}>
            {t.note}
          </Note>
        )}
        <Section title="Details" id="d">
          <Facts
            items={[
              { label: 'Date', value: formatDateTime(t.date) },
              { label: 'Transaction ID', value: t.id },
              {
                label: 'Reference',
                value: (
                  <button type="button" className={s.copy} onClick={copy}>
                    {t.reference} <Copy aria-hidden />
                  </button>
                ),
              },
              { label: 'Paid by', value: t.method },
              { label: 'To', value: t.account },
              ...(task ? [{ label: 'Related task', value: task.title }] : []),
            ]}
          />
        </Section>
      </div>
    </Screen>
  );
}
