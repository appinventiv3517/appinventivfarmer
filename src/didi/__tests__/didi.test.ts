import { describe, expect, it } from 'vitest';
import { FARMERS, completion, filterFarmers } from '../data/farmers';
import { SAMPLE_TASKS, progressOf, tabOf, tasksIn } from '../data/tasks';
import { TRANSACTIONS, filterTxns, totals } from '../data/money';
import { board } from '../data/leaderboard';
import { sampleAttendance, workedMinutes } from '../data/attendance';
import { isDidiPath, to } from '../paths';
import { didiQrText, qrMatrix } from '../lib/qr';

describe('Kisani Didi paths', () => {
  it('prefixes app paths with /didi', () => {
    expect(to('/tasks')).toBe('/didi/tasks');
    expect(to('/')).toBe('/didi');
    expect(to('/didi/home')).toBe('/didi/home');
    expect(isDidiPath('/didi/farmers/KU-F-10231')).toBe(true);
    expect(isDidiPath('/d3/home')).toBe(false);
  });
});

describe('tasks', () => {
  it('puts each status in the right tab', () => {
    expect(tabOf('pending')).toBe('new');
    expect(tabOf('in_progress')).toBe('ongoing');
    expect(tabOf('in_review')).toBe('ongoing');
    expect(tabOf('rejected')).toBe('ongoing');
    expect(tabOf('approved')).toBe('closed');
    expect(tabOf('lapsed')).toBe('closed');
  });
  it('covers every status in the sample data', () => {
    const statuses = new Set(SAMPLE_TASKS.map((t) => t.status));
    expect([...statuses].sort()).toEqual(['approved', 'in_progress', 'in_review', 'lapsed', 'pending', 'rejected']);
    expect(tasksIn(SAMPLE_TASKS, 'new').length + tasksIn(SAMPLE_TASKS, 'ongoing').length + tasksIn(SAMPLE_TASKS, 'closed').length).toBe(SAMPLE_TASKS.length);
  });
  it('caps progress at 100%', () => {
    expect(progressOf({ done: 46, target: 40 })).toBe(100);
    expect(progressOf({ done: 9, target: 15 })).toBe(60);
  });
});

describe('farmers', () => {
  it('searches by name, ID, village and phone', () => {
    expect(filterFarmers(FARMERS, 'sunanda', 'all').map((f) => f.id)).toEqual(['KU-F-10244']);
    expect(filterFarmers(FARMERS, 'ku-f-10305', 'all')).toHaveLength(1);
    expect(filterFarmers(FARMERS, '10278', 'all')[0].name).toBe('Vitthal Shankar Bhise');
    expect(filterFarmers(FARMERS, 'lonar', 'all').every((f) => f.village === 'Lonar')).toBe(true);
    expect(filterFarmers(FARMERS, 'zzzz', 'all')).toHaveLength(0);
  });
  it('filters by profile completion and geo-tag', () => {
    expect(filterFarmers(FARMERS, '', 'complete').every((f) => completion(f) === 100)).toBe(true);
    expect(filterFarmers(FARMERS, '', 'incomplete').every((f) => completion(f) < 100)).toBe(true);
    expect(filterFarmers(FARMERS, '', 'geo').every((f) => f.lands.length === 0 || f.lands.some((l) => !l.geo))).toBe(true);
  });
});

describe('my QR code', () => {
  it('holds the partner ID', () => {
    expect(didiQrText('KD00001')).toBe('kisaniurjaa:didi:KD00001');
  });
  it('draws a square code with the three finder patterns', () => {
    const m = qrMatrix(didiQrText('KD00001'));
    expect(m.length).toBe(25);
    m.forEach((row) => expect(row.length).toBe(25));
    const finderAt = (x: number, y: number) => [0, 6].every((d) => m[y][x + d] && m[y + d][x]) && m[y + 3][x + 3] && !m[y + 1][x + 1];
    expect(finderAt(0, 0) && finderAt(18, 0) && finderAt(0, 18)).toBe(true);
  });
  it('picks a larger version for longer text', () => {
    expect(qrMatrix('x'.repeat(100)).length).toBeGreaterThan(25);
  });
});

describe('transactions', () => {
  it('filters by status and range, newest first', () => {
    const all = filterTxns(TRANSACTIONS, 'all', 'all');
    expect(all).toHaveLength(TRANSACTIONS.length);
    expect(all[0].date >= all[all.length - 1].date).toBe(true);
    expect(filterTxns(TRANSACTIONS, 'failed', 'all').every((t) => t.status === 'failed')).toBe(true);
  });
  it('totals only what is listed', () => {
    const t = totals(TRANSACTIONS);
    expect(t.credited + t.pending + t.failed).toBe(TRANSACTIONS.reduce((a, x) => a + x.amount, 0));
  });
});

describe('leaderboard and attendance', () => {
  it('always gives the Didi her own rank', () => {
    for (const scope of ['mandal', 'state', 'national'] as const)
      for (const period of ['month', 'all'] as const) {
        const { list, me } = board(scope, period);
        expect(me.rank).toBeGreaterThan(0);
        expect(list[0].rank).toBe(1);
        const listed = list.find((l) => l.me);
        if (listed) expect(listed.rank).toBe(me.rank);
        expect(list.every((l, i) => i === 0 || l.score <= list[i - 1].score)).toBe(true);
      }
  });
  it('keeps Sundays off and works out hours', () => {
    const days = sampleAttendance(new Date('2026-11-27T12:00:00'));
    expect(days.some((d) => new Date(`${d.date}T00:00`).getDay() === 0)).toBe(false);
    expect(workedMinutes({ date: '2026-11-20', in: '2026-11-20T09:00:00', out: '2026-11-20T17:30:00' })).toBe(510);
  });
});
