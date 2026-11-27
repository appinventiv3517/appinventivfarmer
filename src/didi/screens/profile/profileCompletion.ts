import type { DidiProfile } from '../../data/didi';
import type { Verification } from '../../store';

/** What makes a Kisani Didi profile complete: each item counts equally. */
export function profileItems(p: DidiProfile, v: Verification) {
  return [
    { label: 'Profile photo', done: !!p.photo },
    { label: 'Contact details', done: !!p.phone && !!p.email },
    { label: 'Personal details', done: !!p.gender && !!p.dob },
    { label: 'Address', done: !!p.village && !!p.district && !!p.pincode },
    { label: 'ID verification', done: v.status !== 'none' },
  ];
}

export function profilePct(p: DidiProfile, v: Verification): number {
  const items = profileItems(p, v);
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}
