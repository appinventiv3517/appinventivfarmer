import { KISANI_DIDI } from '@/data/people';

/**
 * The signed-in Kisani Didi. She is the same person the Farmer App shows as
 * the farmer's Kisani Didi (KISANI_DIDI), so both apps tell one story.
 * Phone numbers are placeholders, not real contacts.
 */
export interface DidiProfile {
  partnerId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  gender: 'Female' | 'Male' | 'Other' | '';
  dob: string;
  cluster: string;
  village: string;
  mandal: string;
  district: string;
  state: string;
  pincode: string;
  languages: string[];
  joined: string;
  photo?: string;
}

export const DIDI_PROFILE: DidiProfile = {
  partnerId: KISANI_DIDI.id ?? 'KD00001',
  name: KISANI_DIDI.name,
  role: 'Kisani Didi',
  phone: KISANI_DIDI.phone,
  email: 'sumita.k@kisaniurjaa.example',
  gender: 'Female',
  dob: '1992-08-14',
  cluster: KISANI_DIDI.area,
  village: 'Ratanpur',
  mandal: 'Buldhana',
  district: 'Buldhana',
  state: 'Maharashtra',
  pincode: '443001',
  languages: KISANI_DIDI.languages,
  joined: '2023-11-02',
};

/** Demo sign-in for reviewers. */
export const DIDI_DEMO = { partnerId: 'KD00001', password: 'didi1234', phone: KISANI_DIDI.phone, otp: '123456' } as const;
