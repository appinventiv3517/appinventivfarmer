import { describe, expect, it } from 'vitest';
import { FARMERS, NO_FARMER_FILTERS, completion, farmerById, filterFarmers } from '../data/farmers';
import { BOOKINGS, bookingById, filterBookings } from '../data/bookings';
import { NOTIFICATIONS } from '../data/notifications';
import { didi, getDidi } from '../store';
import { SAMPLE_CYCLES, STEP_ORDER, isComplete, missing, nextStep, stepDef, submittedCount } from '../data/collection';
import { SAMPLE_TASKS, actionsFor, completedOn, lastReview, progressOf, scoreOf, tabOf, tasksIn } from '../data/tasks';
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
    expect(tabOf('pending')).toBe('pending');
    expect(tabOf('in_progress')).toBe('progress');
    expect(tabOf('in_review')).toBe('progress');
    expect(tabOf('rejected')).toBe('progress');
    expect(tabOf('resubmitted')).toBe('progress');
    expect(tabOf('approved')).toBe('closed');
    expect(tabOf('lapsed')).toBe('closed');
  });
  it('covers every status in the sample data', () => {
    const statuses = new Set(SAMPLE_TASKS.map((t) => t.status));
    expect([...statuses].sort()).toEqual(['approved', 'in_progress', 'in_review', 'lapsed', 'pending', 'rejected', 'resubmitted']);
    expect(tasksIn(SAMPLE_TASKS, 'pending').length + tasksIn(SAMPLE_TASKS, 'progress').length + tasksIn(SAMPLE_TASKS, 'closed').length).toBe(SAMPLE_TASKS.length);
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

describe('task journey', () => {
  it('offers only the actions each status allows', () => {
    expect(actionsFor('pending')).toEqual({ start: true, addProgress: false, resubmit: false });
    expect(actionsFor('in_progress')).toEqual({ start: false, addProgress: true, resubmit: false });
    expect(actionsFor('rejected')).toEqual({ start: false, addProgress: false, resubmit: true });
    for (const st of ['in_review', 'resubmitted', 'approved', 'lapsed'] as const) expect(actionsFor(st)).toEqual({ start: false, addProgress: false, resubmit: false });
  });
  it('moves a task through start, progress, review, rejection, resubmission and approval', () => {
    const id = 'T-2611';
    const get = () => getDidi().tasks.find((t) => t.id === id)!;
    didi.startTask(id);
    expect(get().status).toBe('in_progress');
    didi.saveProgress(id, 4, 'Four farmers registered', [{ id: 'x', kind: 'photo', name: 'a.jpg' }]);
    expect(get().status).toBe('in_progress');
    expect(get().done).toBe(4);
    didi.submitForReview(id, 10, 'All ten done', []);
    expect(get().status).toBe('in_review');
    didi.reviewTask(id, 'rejected', 5, 'Two photos are missing');
    expect(get().status).toBe('rejected');
    expect(lastReview(get())?.adminComment).toBe('Two photos are missing');
    didi.saveProgress(id, 10, 'Retaking photos', []);
    expect(get().status).toBe('rejected');
    didi.submitForReview(id, 10, 'Photos added', []);
    expect(get().status).toBe('resubmitted');
    expect(get().submissions[get().submissions.length - 1].resubmission).toBe(true);
    didi.reviewTask(id, 'approved', 9, 'Good');
    expect(get().status).toBe('approved');
    expect(completedOn(get())).toBeTruthy();
    expect(scoreOf(get())).toBe(9);
    expect(tabOf(get().status)).toBe('closed');
  });
  it('has a sample task in every status', () => {
    const statuses = new Set(SAMPLE_TASKS.map((t) => t.status));
    for (const st of ['pending', 'in_progress', 'in_review', 'rejected', 'resubmitted', 'approved', 'lapsed']) expect(statuses.has(st as never)).toBe(true);
  });
});

describe('farmer verification', () => {
  it('filters by verification and registration date', () => {
    const verified = filterFarmers(FARMERS, '', { ...NO_FARMER_FILTERS, verify: 'verified' });
    expect(verified.length).toBeGreaterThan(0);
    expect(verified.every((f) => f.verification.status === 'verified')).toBe(true);
    const recent = filterFarmers(FARMERS, '', { ...NO_FARMER_FILTERS, from: '2026-01-01' });
    expect(recent.every((f) => f.registeredOn >= '2026-01-01')).toBe(true);
    expect(filterFarmers(FARMERS, 'lonar', NO_FARMER_FILTERS).every((f) => f.village === 'Lonar')).toBe(true);
  });
  it('goes from not verified to pending to verified or failed', () => {
    const id = 'KU-F-10278';
    didi.submitFarmerVerification(id, { docType: 'Aadhaar', idLast4: '1234' });
    expect(getDidi().farmerVerify[id].status).toBe('pending');
    didi.decideFarmerVerification(id, 'failed', 'Blurred photo');
    expect(getDidi().farmerVerify[id]).toMatchObject({ status: 'failed', reason: 'Blurred photo' });
    didi.submitFarmerVerification(id, { docType: 'Aadhaar', idLast4: '1234' });
    didi.decideFarmerVerification(id, 'verified');
    expect(getDidi().farmerVerify[id].status).toBe('verified');
  });
});

describe('bookings', () => {
  const name = (id: string) => farmerById(id)?.name ?? id;
  it('belong to farmers in the cluster', () => {
    expect(BOOKINGS.every((b) => !!farmerById(b.farmerId))).toBe(true);
  });
  it('search by booking ID or farmer name, and filter by status and date', () => {
    expect(filterBookings(BOOKINGS, '#4619', { status: 'all' }, name).map((b) => b.id)).toEqual(['4619']);
    expect(filterBookings(BOOKINGS, 'manisha', { status: 'all' }, name).every((b) => b.farmerId === 'KU-F-10283')).toBe(true);
    expect(filterBookings(BOOKINGS, '', { status: 'rejected' }, name).every((b) => b.status === 'rejected')).toBe(true);
    const r = filterBookings(BOOKINGS, '', { status: 'all', from: '2000-01-01', to: '2000-01-02' }, name);
    expect(r).toEqual([]);
  });
  it('notifications name the booking and open it', () => {
    const notes = NOTIFICATIONS.filter((n) => n.category === 'booking');
    expect(notes.length).toBeGreaterThanOrEqual(3);
    for (const n of notes) {
      const id = n.link!.split('/').pop()!;
      expect(bookingById(id)).toBeTruthy();
      expect(n.title).toContain(`#${id}`);
    }
  });
});

describe('farmer data collection', () => {
  const field = (step: string, key: string) => stepDef(step)!.sections.flatMap((x) => x.fields).find((f) => f.key === key)!;
  it('works out totals from what is entered', () => {
    const e = { hours: '6', days: '2', fuelPerHour: '4', fuelCostPerHour: '360', rent: '1800', maleCount: '2', maleWage: '45', lHours: '6', lDays: '2', other: '100' };
    expect(field('land_prep', 'prepTime').compute!(e, {})).toBe(12);
    expect(field('land_prep', 'fuel').compute!(e, {})).toBe(48);
    expect(field('land_prep', 'labourCost').compute!(e, {})).toBe(1080);
    expect(field('land_prep', 'total').compute!(e, {})).toBe(1800 + 4320 + 1080 + 100);
    expect(field('transport', 'tripFuel').compute!({ distance: '18', economy: '6', fuelCost: '92' }, {})).toBe(276);
    expect(field('intercultivation', 'das').compute!({ date: '2026-07-04' }, { sown: '2026-06-24' })).toBe(10);
    expect(field('nutrient', 'fertCost').compute!({}, {})).toBeNull();
  });
  it('lists required fields left empty', () => {
    expect(missing(stepDef('intercultivation')!, { date: '2026-07-01' })).toEqual(['Method adopted']);
    expect(missing(stepDef('sowing')!, { date: '2026-07-01', seedOrSapling: 'Seed' })).toEqual([]);
  });
  it('fills steps in order and completes a cycle', () => {
    const id = didi.startCycle('KU-F-10283', 'l1', [{ date: '2026-06-20', prepType: 'Ploughing' }]);
    const get = () => getDidi().collection.find((c) => c.id === id)!;
    expect(submittedCount(get())).toBe(1);
    expect(nextStep(get())).toBe('sowing');
    for (const k of STEP_ORDER.slice(1)) didi.saveStep(id, k, [{ date: '2026-07-01' }]);
    expect(isComplete(get())).toBe(true);
    expect(nextStep(get())).toBeUndefined();
    expect(get().no).toBe(1);
  });
  it('has sample cycles for Ram Prasad Yadav: one complete, one in progress', () => {
    const mine = SAMPLE_CYCLES.filter((c) => c.farmerId === 'KU-F-10231');
    expect(mine.map(isComplete)).toEqual([true, false]);
    expect(mine.every((c) => !!farmerById(c.farmerId)!.lands.find((l) => l.id === c.landId))).toBe(true);
  });
});
