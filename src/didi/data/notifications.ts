import { daysFromNow } from './dates';

export type NoteCategory = 'task' | 'deadline' | 'review' | 'farmer' | 'attendance' | 'payment' | 'announcement';

export interface DidiNotification {
  id: string;
  category: NoteCategory;
  title: string;
  body: string;
  at: string;
  /** In-app path opened when the notification is tapped. */
  link?: string;
}

export const NOTE_CATEGORY: Record<NoteCategory, string> = {
  task: 'New task',
  deadline: 'Deadline',
  review: 'Task review',
  farmer: 'Farmers',
  attendance: 'Attendance',
  payment: 'Payments',
  announcement: 'Announcement',
};

export const NOTIFICATIONS: DidiNotification[] = [
  { id: 'n1', category: 'task', title: 'New task: Geo-tag rabi wheat plots', body: '6 plots in the Ratanpur cluster. Due in 5 days.', at: daysFromNow(0, 8, 32), link: '/tasks/T-2612' },
  { id: 'n2', category: 'deadline', title: 'Due in 2 days: Straw clearing follow-up calls', body: '9 of 15 calls done.', at: daysFromNow(0, 7, 0), link: '/tasks/T-2598' },
  { id: 'n3', category: 'review', title: 'Resubmit: Profile photos for Lonar farmers', body: 'Three photos are too dark. Retake them in daylight.', at: daysFromNow(-1, 11, 4), link: '/tasks/T-2584' },
  { id: 'n4', category: 'task', title: 'New task: Register new farmers in Mehkar', body: 'Register 10 farmers. Due in 9 days.', at: daysFromNow(-1, 9, 2), link: '/tasks/T-2611' },
  { id: 'n5', category: 'payment', title: 'Payout recorded: ₹4,200', body: 'Pending until the transfer is confirmed.', at: daysFromNow(-2, 11, 6), link: '/transactions/TX-90412' },
  { id: 'n6', category: 'farmer', title: 'Shobha Vasant Kale joined', body: 'Her profile is 17% complete. Add her address and land.', at: daysFromNow(-3, 16, 20), link: '/farmers/KU-F-10326' },
  { id: 'n7', category: 'attendance', title: 'You didn’t check out yesterday', body: 'Your day was closed at 7:00 PM. Contact support if this is wrong.', at: daysFromNow(-4, 19, 0), link: '/attendance' },
  { id: 'n8', category: 'announcement', title: 'Rabi season training on 4 December', body: 'All Kisani Didis of Buldhana district are invited. Details will follow.', at: daysFromNow(-5, 12, 0) },
  { id: 'n9', category: 'payment', title: 'Payout credited: ₹6,500', body: 'Credited to SBI ···· 4821.', at: daysFromNow(-9, 14, 22), link: '/transactions/TX-90377' },
  { id: 'n10', category: 'review', title: 'Approved: Samriddhi awareness meeting', body: 'Score 9 / 10. “Well organised.”', at: daysFromNow(-17, 10, 2), link: '/tasks/T-2561' },
];

export const INITIALLY_UNREAD = ['n1', 'n2', 'n3', 'n4', 'n5'];
