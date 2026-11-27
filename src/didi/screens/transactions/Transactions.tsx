import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownLeft, Info } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { Chip, ChipRow, Toggle } from '@/d3/ui/Controls';
import { SWAP } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Note, SkelList, StatusTag } from '../../ui/Blocks';
import { useLoad } from '../../ui/Kit';
import { TRANSACTIONS, TXN_RANGES, TXN_STATUS, filterTxns, totals, type TxnRange, type TxnStatus } from '../../data/money';
import { to } from '../../paths';
import s from './Transactions.module.css';

export default function Transactions() {
  const [status, setStatus] = useState<TxnStatus | 'all'>('all');
  const [range, setRange] = useState<TxnRange>('90');
  const load = useLoad('txns');
  const list = filterTxns(TRANSACTIONS, status, range);
  const sum = totals(filterTxns(TRANSACTIONS, 'all', range));
  return (
    <Screen title="My transactions" backTo="/home">
      <PageTitle kicker="Payments to you" title="My transactions" />
      <div className={s.page}>
        <div className={s.summary}>
          <span className={s.kicker}>Credited · {TXN_RANGES.find((r) => r.value === range)?.label}</span>
          <motion.strong key={`${range}-${sum.credited}`} className={s.total} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {formatCurrency(sum.credited)}
          </motion.strong>
          <div className={s.split}>
            <span>
              <small>Pending</small>
              <strong>{formatCurrency(sum.pending)}</strong>
            </span>
            <span>
              <small>Failed</small>
              <strong>{formatCurrency(sum.failed)}</strong>
            </span>
            <span>
              <small>Records</small>
              <strong>{filterTxns(TRANSACTIONS, 'all', range).length}</strong>
            </span>
          </div>
        </div>

        <div className={s.filters}>
          <Toggle label="Date range" value={range} onChange={setRange} options={TXN_RANGES} />
          <ChipRow label="Status" className={s.chips}>
            <Chip selected={status === 'all'} onClick={() => setStatus('all')}>
              All
            </Chip>
            {(Object.keys(TXN_STATUS) as TxnStatus[]).map((k) => (
              <Chip key={k} selected={status === k} onClick={() => setStatus(k)} count={filterTxns(TRANSACTIONS, k, range).length}>
                {TXN_STATUS[k].label}
              </Chip>
            ))}
          </ChipRow>
        </div>

        {load.status === 'loading' ? (
          <SkelList count={4} thumb={44} />
        ) : load.status === 'error' ? (
          <ErrorState error={load.error} onRetry={load.retry} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${status}-${range}`} {...SWAP}>
              {list.length ? (
                <ul className={s.list}>
                  {list.map((t) => (
                    <li key={t.id}>
                      <Link to={to(`/transactions/${t.id}`)} className={s.row}>
                        <span className={`${s.icon} ${s[`i_${t.status}`]}`}>
                          <ArrowDownLeft aria-hidden />
                        </span>
                        <span className={s.text}>
                          <strong>{t.title}</strong>
                          <small>
                            {formatDate(t.date, 'medium')} · {t.method}
                          </small>
                        </span>
                        <span className={s.amount}>
                          <strong className={t.status === 'failed' ? s.struck : ''}>{formatCurrency(t.amount)}</strong>
                          <StatusTag tone={TXN_STATUS[t.status].tone}>{TXN_STATUS[t.status].label}</StatusTag>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState animation="records" title="No transactions" body="Nothing matches this status and date range." action={<Button variant="secondary" onClick={() => (setStatus('all'), setRange('all'))}>Show all</Button>} compact />
              )}
            </motion.div>
          </AnimatePresence>
        )}
        <div className={s.gutter}>
          <Note tone="info" icon={<Info aria-hidden />}>
            These records come from Kisani Urjaa. For a question about a payment, contact support with its reference number.
          </Note>
        </div>
      </div>
    </Screen>
  );
}
