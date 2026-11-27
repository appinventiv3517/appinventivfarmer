import { daysFromNow, isoDay } from './dates';

/**
 * Straw clearing (baler) bookings made by, or for, farmers in the Didi's
 * cluster. Same kind of booking as in the Farmer App. Decisions come from
 * Kisani Urjaa; the Didi app only shows them. Sample data.
 */
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancel_requested' | 'cancelled' | 'completed';

export interface DidiBooking {
  id: string;
  farmerId: string;
  service: string;
  landName: string;
  crop: string;
  acres: number;
  /** Field visit date (yyyy-mm-dd) and slot (HH:mm). */
  date: string;
  slot: string;
  createdAt: string;
  status: BookingStatus;
  requestedBy: 'Farmer' | 'Kisani Didi';
  decidedAt?: string;
  operator?: { name: string; phone: string };
  notes?: string;
  /** Kisani Urjaa's remark on the decision. */
  remarks?: string;
  rejectionReason?: string;
  cancelReason?: string;
  cancelRequestedAt?: string;
  completedAt?: string;
}

export const BOOKING_LABEL: Record<BookingStatus, string> = {
  pending: 'Awaiting approval',
  approved: 'Booking approved',
  rejected: 'Booking rejected',
  cancel_requested: 'Cancellation requested',
  cancelled: 'Cancellation approved',
  completed: 'Completed',
};

export const BOOKING_TONE: Record<BookingStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancel_requested: 'warning',
  cancelled: 'neutral',
  completed: 'info',
};

export const BOOKING_EXPLAIN: Record<BookingStatus, string> = {
  pending: 'The request is with Kisani Urjaa. You’ll get a notification when it’s decided.',
  approved: 'Approved, and an operator is assigned for the visit.',
  rejected: 'Kisani Urjaa could not accept this booking. The reason is below.',
  cancel_requested: 'The farmer asked to cancel. Kisani Urjaa is checking the request.',
  cancelled: 'The cancellation was approved. No visit will take place.',
  completed: 'The operator visited and the straw was cleared.',
};

const SERVICE = 'Straw clearing (baler)';
const day = (n: number) => isoDay(new Date(daysFromNow(n, 10)));
const OP1 = { name: 'Arpit Verma', phone: '9000000003' };
const OP2 = { name: 'Santosh Jadhav', phone: '9000000011' };

export const BOOKINGS: DidiBooking[] = [
  { id: '4627', farmerId: 'KU-F-10312', service: SERVICE, landName: 'Road field', crop: 'Wheat', acres: 2.75, date: day(6), slot: '10:00', createdAt: daysFromNow(0, 9, 40), status: 'pending', requestedBy: 'Kisani Didi', notes: 'Booked on the farmer’s behalf during the visit.' },
  { id: '4619', farmerId: 'KU-F-10283', service: SERVICE, landName: 'Main field', crop: 'Paddy', acres: 3.5, date: day(3), slot: '09:00', createdAt: daysFromNow(-2, 16, 5), status: 'approved', requestedBy: 'Farmer', decidedAt: daysFromNow(0, 11, 12), operator: OP1, remarks: 'Operator will call the farmer a day before the visit.' },
  { id: '4612', farmerId: 'KU-F-10291', service: SERVICE, landName: 'East field', crop: 'Cotton', acres: 5, date: day(-1), slot: '15:00', createdAt: daysFromNow(-4, 12, 30), status: 'rejected', requestedBy: 'Farmer', decidedAt: daysFromNow(-1, 10, 20), rejectionReason: 'No baler is free in Deulgaon Mahi on this date. Please book another date.' },
  { id: '4608', farmerId: 'KU-F-10231', service: SERVICE, landName: 'Paddy plot', crop: 'Paddy', acres: 2.5, date: day(4), slot: '12:00', createdAt: daysFromNow(-5, 18, 0), status: 'cancelled', requestedBy: 'Farmer', decidedAt: daysFromNow(-4, 9, 30), operator: OP2, cancelReason: 'The farmer cleared the field himself after an early harvest.', cancelRequestedAt: daysFromNow(-3, 8, 15), remarks: 'Cancellation approved. No charge.' },
  { id: '4603', farmerId: 'KU-F-10244', service: SERVICE, landName: 'Home field', crop: 'Cotton', acres: 3, date: day(2), slot: '11:00', createdAt: daysFromNow(-6, 15, 0), status: 'cancel_requested', requestedBy: 'Farmer', decidedAt: daysFromNow(-5, 10, 0), operator: OP1, cancelReason: 'Cotton picking is not finished yet.', cancelRequestedAt: daysFromNow(-1, 19, 5) },
  { id: '4594', farmerId: 'KU-F-10368', service: SERVICE, landName: 'Main field', crop: 'Paddy', acres: 2.25, date: day(-8), slot: '09:00', createdAt: daysFromNow(-14, 11, 20), status: 'completed', requestedBy: 'Kisani Didi', decidedAt: daysFromNow(-13, 10, 0), operator: OP2, completedAt: daysFromNow(-8, 13, 40), remarks: 'Field cleared. 41 bales collected.' },
  { id: '4588', farmerId: 'KU-F-10347', service: SERVICE, landName: 'South plot', crop: 'Soybean', acres: 2, date: day(-11), slot: '10:00', createdAt: daysFromNow(-16, 9, 0), status: 'completed', requestedBy: 'Farmer', decidedAt: daysFromNow(-15, 12, 0), operator: OP1, completedAt: daysFromNow(-11, 12, 15) },
  { id: '4581', farmerId: 'KU-F-10257', service: SERVICE, landName: 'River side', crop: 'Soybean', acres: 4, date: day(-15), slot: '14:00', createdAt: daysFromNow(-20, 17, 45), status: 'rejected', requestedBy: 'Farmer', decidedAt: daysFromNow(-18, 10, 0), rejectionReason: 'The soybean was still standing on this date. Please book after the harvest.' },
];

export const bookingById = (id: string) => BOOKINGS.find((b) => b.id === id.replace(/^#/, ''));
export const bookingsFor = (farmerId: string) => BOOKINGS.filter((b) => b.farmerId === farmerId);

export type BookingFilter = { status: BookingStatus | 'all'; from?: string; to?: string };

/** Search by booking ID or farmer name; filter by status and field-visit date. */
export function filterBookings(list: DidiBooking[], q: string, f: BookingFilter, farmerName: (id: string) => string): DidiBooking[] {
  const query = q.trim().toLowerCase().replace(/^#/, '');
  return list
    .filter((b) => {
      if (f.status !== 'all' && b.status !== f.status) return false;
      if (f.from && b.date < f.from) return false;
      if (f.to && b.date > f.to) return false;
      if (!query) return true;
      return b.id.includes(query) || farmerName(b.farmerId).toLowerCase().includes(query) || b.farmerId.toLowerCase().includes(query);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
