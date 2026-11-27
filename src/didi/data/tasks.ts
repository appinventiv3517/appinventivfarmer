import { daysFromNow } from './dates';

export type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'approved' | 'rejected' | 'lapsed';
export type TaskTab = 'new' | 'ongoing' | 'closed';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  lapsed: 'Lapsed',
};

export const STATUS_TONE: Record<TaskStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  pending: 'neutral',
  in_progress: 'info',
  in_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  lapsed: 'neutral',
};

/** Which tab a status belongs to. Rejected tasks stay in Ongoing so they can be resubmitted. */
export function tabOf(status: TaskStatus): TaskTab {
  if (status === 'pending') return 'new';
  if (status === 'approved' || status === 'lapsed') return 'closed';
  return 'ongoing';
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

export const progressOf = (t: Pick<Task, 'done' | 'target'>) => (t.target ? Math.min(100, Math.round((t.done / t.target) * 100)) : 0);

export function tasksIn(tasks: Task[], tab: TaskTab): Task[] {
  const list = tasks.filter((t) => tabOf(t.status) === tab);
  return tab === 'closed' ? list.sort((a, b) => b.dueOn.localeCompare(a.dueOn)) : list.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}
