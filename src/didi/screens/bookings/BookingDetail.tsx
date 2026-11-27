import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Ban, ChevronRight, MessageSquareText, Phone, XCircle } from 'lucide-react';
import { formatDate, formatDateTime, formatPhone, initials } from '@/lib/format';
import { SPRING_SOFT } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Note, Skel, StatusTag, Tracker, type TrackStep } from '../../ui/Blocks';
import { Facts, Section, useLoad } from '../../ui/Kit';
import { BOOKING_EXPLAIN, BOOKING_LABEL, BOOKING_TONE, bookingById, type DidiBooking } from '../../data/bookings';
import { VERIFY_LABEL, VERIFY_TONE, farmerById } from '../../data/farmers';
import { useFarmerVerification } from '../../store';
import { to } from '../../paths';
import s from './Bookings.module.css';

/** The booking's journey so far, for the tracker. */
function steps(b: DidiBooking): TrackStep[] {
  const requested: TrackStep = { label: 'Requested', meta: formatDate(b.createdAt, 'short'), state: 'done' };
  if (b.status === 'pending') return [requested, { label: 'Approval', meta: 'With Kisani Urjaa', state: 'current' }, { label: 'Field visit', meta: formatDate(b.date, 'short'), state: 'upcoming' }];
  if (b.status === 'rejected') return [requested, { label: 'Rejected', meta: b.decidedAt ? formatDate(b.decidedAt, 'short') : undefined, state: 'failed' }];
  const approved: TrackStep = { label: 'Approved', meta: b.decidedAt ? formatDate(b.decidedAt, 'short') : undefined, state: 'done' };
  if (b.status === 'cancel_requested') return [requested, approved, { label: 'Cancellation', meta: 'Requested', state: 'current' }];
  if (b.status === 'cancelled') return [requested, approved, { label: 'Cancelled', meta: 'Approved', state: 'failed' }];
  if (b.status === 'completed') return [requested, approved, { label: 'Field cleared', meta: b.completedAt ? formatDate(b.completedAt, 'short') : undefined, state: 'done' }];
  return [requested, approved, { label: 'Field visit', meta: formatDate(b.date, 'short'), state: 'upcoming' }];
}

export default function BookingDetail() {
  const { id = '' } = useParams();
  const b = bookingById(id);
  const f = b ? farmerById(b.farmerId) : undefined;
  const v = useFarmerVerification(f);
  const load = useLoad(`booking-${id}`);

  if (!b)
    return (
      <Screen title="Booking" backTo="/bookings">
        <EmptyState animation="search" title="Booking not found" body={`There’s no booking #${id.replace(/^#/, '')} for farmers in your cluster.`} action={<Button to="/bookings">See all bookings</Button>} />
      </Screen>
    );

  return (
    <Screen title={`Booking #${b.id}`} backTo="/bookings">
      <PageTitle kicker={b.service} title={`Booking #${b.id}`} />
      {load.status === 'loading' ? (
        <div className={s.detail} aria-busy="true" aria-label="Loading booking">
          <Skel h={180} r="var(--r-xl)" />
          <Skel h={88} r="var(--r-lg)" />
          <Skel h={220} r="var(--r-xl)" />
        </div>
      ) : load.status === 'error' ? (
        <ErrorState error={load.error} onRetry={load.retry} />
      ) : (
        <div className={s.detail}>
          <motion.div className={s.hero} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
            <div className={s.heroTop}>
              <StatusTag tone={BOOKING_TONE[b.status]} size="lg">
                {BOOKING_LABEL[b.status]}
              </StatusTag>
              <span className={s.heroDate}>Visit {formatDate(b.date, 'short')}</span>
            </div>
            <p className={s.heroExplain}>{BOOKING_EXPLAIN[b.status]}</p>
            <Tracker steps={steps(b)} />
          </motion.div>

          {b.status === 'rejected' && b.rejectionReason && (
            <Note tone="danger" icon={<XCircle aria-hidden />} title="Reason for rejection">
              {b.rejectionReason}
            </Note>
          )}
          {(b.status === 'cancel_requested' || b.status === 'cancelled') && b.cancelReason && (
            <Note tone={b.status === 'cancelled' ? 'neutral' : 'warning'} icon={<Ban aria-hidden />} title={b.status === 'cancelled' ? 'Cancellation approved' : 'Cancellation requested'}>
              {b.cancelReason}
              {b.cancelRequestedAt ? ` Asked on ${formatDate(b.cancelRequestedAt, 'medium')}.` : ''}
            </Note>
          )}
          {b.remarks && (
            <Note tone="info" icon={<MessageSquareText aria-hidden />} title="Remarks from Kisani Urjaa">
              {b.remarks}
            </Note>
          )}

          <Section title="Booking details" id="bd">
            <Facts
              items={[
                { label: 'Booking reference', value: `#${b.id}` },
                { label: 'Service', value: b.service },
                { label: 'Land', value: `${b.landName} · ${b.acres} acres` },
                { label: 'Crop', value: b.crop },
                { label: 'Visit date', value: `${formatDate(b.date, 'medium')}, ${b.slot}` },
                { label: 'Booked on', value: formatDateTime(b.createdAt) },
                { label: 'Booked by', value: b.requestedBy },
                ...(b.decidedAt ? [{ label: b.status === 'rejected' ? 'Rejected on' : 'Approved on', value: formatDateTime(b.decidedAt) }] : []),
                ...(b.completedAt ? [{ label: 'Completed on', value: formatDateTime(b.completedAt) }] : []),
                ...(b.operator ? [{ label: 'Operator', value: `${b.operator.name} · ${formatPhone(b.operator.phone)}` }] : []),
                ...(b.notes ? [{ label: 'Notes', value: b.notes }] : []),
              ]}
            />
          </Section>

          {f && (
            <Section title="Farmer" id="fm">
              <Link to={to(`/farmers/${f.id}`)} className={s.farmerRow}>
                <span className={s.avatar} aria-hidden>
                  {initials(f.name)}
                </span>
                <span className={s.farmerText}>
                  <strong>{f.name}</strong>
                  <small>
                    {f.id} · {f.village === f.mandal ? f.village : `${f.village}, ${f.mandal}`}
                  </small>
                  {v && (
                    <span>
                      <StatusTag tone={VERIFY_TONE[v.status]}>{VERIFY_LABEL[v.status]}</StatusTag>
                    </span>
                  )}
                </span>
                <ChevronRight aria-hidden width={18} height={18} />
              </Link>
              <div className={s.farmerActions}>
                <Button size="sm" href={`tel:${f.phone}`} icon={<Phone aria-hidden />}>
                  Call {f.name.split(' ')[0]}
                </Button>
                {b.operator && (
                  <Button size="sm" variant="secondary" href={`tel:${b.operator.phone}`} icon={<Phone aria-hidden />}>
                    Call operator
                  </Button>
                )}
              </div>
            </Section>
          )}
        </div>
      )}
    </Screen>
  );
}
