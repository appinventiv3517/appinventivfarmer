import { daysFromNow } from './dates';

export type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'approved' | 'rejected' | 'resubmitted' | 'lapsed';
export type TaskTab = 'pending' | 'progress' | 'closed';

export const TASK_TABS: { value: TaskTab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  resubmitted: 'Resubmitted',
  lapsed: 'Lapsed',
};

export const STATUS_TONE: Record<TaskStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  pending: 'neutral',
  in_progress: 'info',
  in_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  resubmitted: 'warning',
  lapsed: 'neutral',
};

/** One line on what the status means for the Didi. */
export const STATUS_EXPLAIN: Record<TaskStatus, string> = {
  pending: 'Assigned to you. Start it when you begin the work.',
  in_progress: 'Add progress as you go, then submit it for approval.',
  in_review: 'Submitted. Kisani Urjaa is reviewing your work.',
  approved: 'Approved by Kisani Urjaa. This task is closed.',
  rejected: 'Returned for changes. Fix it and resubmit.',
  resubmitted: 'Resubmitted. Kisani Urjaa is reviewing it again.',
  lapsed: 'Closed without approval.',
};

/**
 * Which tab a status belongs to. Rejected, in-review and resubmitted tasks stay in
 * In progress until Kisani Urjaa closes them; approved and lapsed ones are Closed.
 */
export function tabOf(status: TaskStatus): TaskTab {
  if (status === 'pending') return 'pending';
  if (status === 'approved' || status === 'lapsed') return 'closed';
  return 'progress';
}

/** What the Didi can do with a task in each status. Nothing else is offered. */
export function actionsFor(status: TaskStatus): { start: boolean; addProgress: boolean; resubmit: boolean } {
  return { start: status === 'pending', addProgress: status === 'in_progress', resubmit: status === 'rejected' };
}

export interface Proof {
  id: string;
  kind: 'photo' | 'video' | 'file';
  name: string;
  /** Data URL for photos picked on this device; sample proofs use a photo slot. */
  url?: string;
  slot?: string;
  size?: number;
}

export interface Submission {
  id: string;
  at: string;
  /** Target units reported in this submission. */
  count: number;
  note: string;
  proofs: Proof[];
  kind: 'progress' | 'review';
  outcome?: 'approved' | 'rejected';
  /** A submission sent again after a rejection. */
  resubmission?: boolean;
  score?: number;
  adminComment?: string;
  reviewedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  assignedBy: string;
  assignedOn: string;
  dueOn: string;
  target: number;
  unit: string;
  done: number;
  status: TaskStatus;
  submissions: Submission[];
  draftNote?: string;
  /** Instructions from Kisani Urjaa shown with the task. */
  adminNote?: string;
}

const ADMIN = 'Kisani Urjaa field team';

export const SAMPLE_TASKS: Task[] = [
  {
    id: 'T-2611',
    title: 'Register new farmers in Mehkar',
    summary: 'Add farmers from Mehkar to the app with their personal details and land.',
    description: 'Visit Mehkar and register farmers who have not joined Kisani Urjaa yet. For each farmer, add personal details, address and at least one land record. Take a photo of the farmer at the visit as proof.',
    category: 'Farmer onboarding',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-1, 9),
    dueOn: daysFromNow(9, 18),
    target: 10,
    unit: 'farmers',
    done: 0,
    status: 'pending',
    submissions: [],
  },
  {
    id: 'T-2612',
    title: 'Geo-tag rabi wheat plots',
    summary: 'Walk the boundary of each wheat plot and capture its geo-tag.',
    description: 'Geo-tag the wheat plots registered for Rabi 2026–27 in the Ratanpur cluster. Walk the boundary with the farmer and capture each corner. Upload a photo of the plot with the farmer.',
    category: 'Land geo-tagging',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(0, 8, 30),
    dueOn: daysFromNow(5, 18),
    target: 6,
    unit: 'plots',
    done: 0,
    status: 'pending',
    submissions: [],
    adminNote: 'Capture at least four corner points per plot. Skip plots that are already geo-tagged.',
  },
  {
    id: 'T-2598',
    title: 'Straw clearing follow-up calls',
    summary: 'Call farmers whose paddy straw was baled and note their feedback.',
    description: 'Call every farmer whose paddy straw was cleared this month. Ask whether the field was left clean and note any problems. Upload a short note or file listing who you reached.',
    category: 'Farmer follow-up',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-6, 10),
    dueOn: daysFromNow(2, 18),
    target: 15,
    unit: 'calls',
    done: 9,
    status: 'in_progress',
    submissions: [{ id: 's1', at: daysFromNow(-2, 17, 20), count: 9, note: 'Reached 9 farmers in Ratanpur and Dhad. Two asked for baling again next season.', proofs: [{ id: 'p1', kind: 'file', name: 'call-list-ratanpur.pdf', size: 184_000 }], kind: 'progress' }],
  },
  {
    id: 'T-2590',
    title: 'Soil health camp turnout',
    summary: 'Bring farmers to the soil testing camp in Chikhli and record attendance.',
    description: 'Invite farmers from Chikhli and Amdapur to the soil health camp. Record how many attended and upload photos from the camp.',
    category: 'Events',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-12, 10),
    dueOn: daysFromNow(-1, 18),
    target: 25,
    unit: 'farmers',
    done: 25,
    status: 'in_review',
    submissions: [
      { id: 's1', at: daysFromNow(-5, 16), count: 14, note: 'First batch of invitations done.', proofs: [], kind: 'progress' },
      { id: 's2', at: daysFromNow(-1, 15, 40), count: 25, note: '25 farmers attended. Photos of the registration desk and session attached.', proofs: [{ id: 'p1', kind: 'photo', name: 'camp-session.jpg', slot: 'kisani-farmer-training' }, { id: 'p2', kind: 'photo', name: 'camp-crowd.jpg', slot: 'kisani-samriddhi-session' }], kind: 'review' },
    ],
  },
  {
    id: 'T-2584',
    title: 'Profile photos for Lonar farmers',
    summary: 'Add a clear profile photo for each registered farmer in Lonar.',
    description: 'Add a clear, front-facing profile photo for each farmer registered in Lonar. Photos must be taken in daylight.',
    adminNote: 'Face the farmer towards the light. No caps or sunglasses.',
    category: 'Farmer onboarding',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-14, 10),
    dueOn: daysFromNow(3, 18),
    target: 8,
    unit: 'photos',
    done: 8,
    status: 'rejected',
    submissions: [{ id: 's1', at: daysFromNow(-3, 12), count: 8, note: 'All 8 photos added.', proofs: [{ id: 'p1', kind: 'photo', name: 'lonar-visit.jpg', slot: 'kisani-field-farmers' }], kind: 'review', outcome: 'rejected', score: 4, adminComment: 'Three photos are too dark to recognise the farmer. Please retake them in daylight and resubmit.', reviewedAt: daysFromNow(-1, 11) }],
  },
  {
    id: 'T-2576',
    title: 'Residue-free field photos',
    summary: 'Photograph fields after straw clearing to show they were left clean.',
    description: 'Visit fields where straw was cleared this season and photograph each one, with the farmer, showing the field is clean. One photo per field.',
    category: 'Field verification',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-16, 10),
    dueOn: daysFromNow(4, 18),
    target: 12,
    unit: 'fields',
    done: 12,
    status: 'resubmitted',
    submissions: [
      { id: 's1', at: daysFromNow(-9, 16, 10), count: 7, note: 'Seven fields in Ratanpur photographed.', proofs: [{ id: 'p1', kind: 'photo', name: 'ratanpur-field.jpg', slot: 'kisani-paddy-green' }], kind: 'progress' },
      { id: 's2', at: daysFromNow(-6, 17, 30), count: 12, note: 'All 12 fields done.', proofs: [{ id: 'p1', kind: 'photo', name: 'dhad-field.jpg', slot: 'kisani-field-farmers' }], kind: 'review', outcome: 'rejected', score: 5, adminComment: 'Two photos do not show the farmer. Add photos with the farmer present for fields 4 and 9.', reviewedAt: daysFromNow(-4, 12) },
      { id: 's3', at: daysFromNow(-2, 15, 5), count: 12, note: 'Retook fields 4 and 9 with the farmers present.', proofs: [{ id: 'p1', kind: 'photo', name: 'field-4.jpg', slot: 'kisani-field-farmers' }, { id: 'p2', kind: 'video', name: 'field-9-walk.mp4', size: 6_400_000 }], kind: 'review', resubmission: true },
    ],
  },
  {
    id: 'T-2561',
    title: 'Samriddhi awareness meeting',
    summary: 'Host the Samriddhi meeting in Ratanpur and share photos.',
    description: 'Host the Samriddhi awareness meeting in Ratanpur. Upload photos of the meeting and the attendance count.',
    category: 'Events',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-30, 10),
    dueOn: daysFromNow(-18, 18),
    target: 40,
    unit: 'farmers',
    done: 46,
    status: 'approved',
    submissions: [{ id: 's1', at: daysFromNow(-19, 17), count: 46, note: '46 farmers attended, 12 of them women farmers.', proofs: [{ id: 'p1', kind: 'photo', name: 'samriddhi-stage.jpg', slot: 'kisani-samriddhi-session' }, { id: 'p2', kind: 'photo', name: 'award.jpg', slot: 'kisani-team-award' }], kind: 'review', outcome: 'approved', score: 9, adminComment: 'Well organised. Good turnout of women farmers.', reviewedAt: daysFromNow(-17, 10) }],
  },
  {
    id: 'T-2547',
    title: 'Kharif crop survey',
    summary: 'Record the kharif crop on every registered plot.',
    description: 'Record the crop sown on each registered plot for Kharif 2026, with the sowing date.',
    category: 'Crop survey',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-60, 10),
    dueOn: daysFromNow(-40, 18),
    target: 20,
    unit: 'plots',
    done: 20,
    status: 'approved',
    submissions: [{ id: 's1', at: daysFromNow(-41, 16), count: 20, note: 'All 20 plots recorded.', proofs: [{ id: 'p1', kind: 'photo', name: 'paddy.jpg', slot: 'kisani-paddy-green' }], kind: 'review', outcome: 'approved', score: 8, adminComment: 'Complete. Thank you.', reviewedAt: daysFromNow(-39, 10) }],
  },
  {
    id: 'T-2533',
    title: 'Collect bank details',
    summary: 'Add bank details for farmers who have none on file.',
    description: 'Collect and add bank account details for farmers who have none on file.',
    category: 'Farmer onboarding',
    assignedBy: ADMIN,
    assignedOn: daysFromNow(-45, 10),
    dueOn: daysFromNow(-25, 18),
    target: 6,
    unit: 'farmers',
    done: 3,
    status: 'lapsed',
    submissions: [{ id: 's1', at: daysFromNow(-28, 15), count: 3, note: 'Three farmers added. Others were away for the harvest.', proofs: [], kind: 'progress' }],
  },
];

/** The date Kisani Urjaa approved the task, if it did. */
export function completedOn(t: Task): string | undefined {
  return [...t.submissions].reverse().find((x) => x.outcome === 'approved')?.reviewedAt;
}

/** The latest score Kisani Urjaa gave, if any. */
export function scoreOf(t: Task): number | undefined {
  return [...t.submissions].reverse().find((x) => x.score !== undefined)?.score;
}

/** The latest reviewed submission (approved or rejected). */
export function lastReview(t: Task): Submission | undefined {
  return [...t.submissions].reverse().find((x) => x.outcome);
}

export const progressOf = (t: Pick<Task, 'done' | 'target'>) => (t.target ? Math.min(100, Math.round((t.done / t.target) * 100)) : 0);

export function tasksIn(tasks: Task[], tab: TaskTab): Task[] {
  const list = tasks.filter((t) => tabOf(t.status) === tab);
  return tab === 'closed' ? list.sort((a, b) => b.dueOn.localeCompare(a.dueOn)) : list.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}
