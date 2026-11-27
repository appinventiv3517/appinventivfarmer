import { daysFromNow } from './dates';

export type TxnStatus = 'credited' | 'pending' | 'failed';

/**
 * Sample payments to the Kisani Didi, as Kisani Urjaa records them. The app
 * only shows these records; it does not calculate amounts or decide when
 * anything is paid.
 */
export interface Transaction {
  id: string;
  title: string;
  /** Reference shown by the payer. */
  reference: string;
  amount: number;
  date: string;
  status: TxnStatus;
  method: string;
  account: string;
  relatedTask?: string;
  note?: string;
}

export const TXN_STATUS: Record<TxnStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  credited: { label: 'Credited', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
};

export const TRANSACTIONS: Transaction[] = [
  { id: 'TX-90412', title: 'Partner payout', reference: 'KU/PAY/2611/0427', amount: 4200, date: daysFromNow(-2, 11, 5), status: 'pending', method: 'Bank transfer', account: 'SBI ···· 4821', relatedTask: 'T-2590', note: 'Shown as pending until Kisani Urjaa confirms the transfer.' },
  { id: 'TX-90377', title: 'Partner payout', reference: 'KU/PAY/2610/0427', amount: 6500, date: daysFromNow(-9, 14, 20), status: 'credited', method: 'Bank transfer', account: 'SBI ···· 4821', relatedTask: 'T-2561' },
  { id: 'TX-90321', title: 'Travel reimbursement', reference: 'KU/TRV/2610/0427', amount: 850, date: daysFromNow(-16, 12, 40), status: 'credited', method: 'UPI', account: 'sumita@upi' },
  { id: 'TX-90288', title: 'Partner payout', reference: 'KU/PAY/2609/0427', amount: 3800, date: daysFromNow(-23, 10, 15), status: 'failed', method: 'Bank transfer', account: 'SBI ···· 4821', note: 'The bank returned this transfer. Kisani Urjaa will retry it; you don’t need to do anything.' },
  { id: 'TX-90289', title: 'Partner payout (retry)', reference: 'KU/PAY/2609/0427-R', amount: 3800, date: daysFromNow(-21, 16, 2), status: 'credited', method: 'Bank transfer', account: 'SBI ···· 4821' },
  { id: 'TX-90230', title: 'Partner payout', reference: 'KU/PAY/2608/0427', amount: 5200, date: daysFromNow(-38, 11, 30), status: 'credited', method: 'Bank transfer', account: 'SBI ···· 4821', relatedTask: 'T-2547' },
  { id: 'TX-90199', title: 'Travel reimbursement', reference: 'KU/TRV/2608/0427', amount: 640, date: daysFromNow(-44, 15, 0), status: 'credited', method: 'UPI', account: 'sumita@upi' },
  { id: 'TX-90145', title: 'Partner payout', reference: 'KU/PAY/2607/0427', amount: 4700, date: daysFromNow(-68, 12, 10), status: 'credited', method: 'Bank transfer', account: 'SBI ···· 4821' },
];

export type TxnRange = '30' | '90' | 'all';
export const TXN_RANGES: { value: TxnRange; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' },
];

export function filterTxns(list: Transaction[], status: TxnStatus | 'all', range: TxnRange, now = new Date()): Transaction[] {
  const since = range === 'all' ? 0 : now.getTime() - Number(range) * 86_400_000;
  return list.filter((t) => (status === 'all' || t.status === status) && new Date(t.date).getTime() >= since).sort((a, b) => b.date.localeCompare(a.date));
}

/** Sum of the listed records, by status. A plain total of what is shown, not a calculation of earnings. */
export function totals(list: Transaction[]) {
  return list.reduce((acc, t) => ({ ...acc, [t.status]: acc[t.status] + t.amount }), { credited: 0, pending: 0, failed: 0 } as Record<TxnStatus, number>);
}
