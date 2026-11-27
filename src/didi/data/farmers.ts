import { DEFAULT_PROFILE } from '@/data/people';

export interface FarmerLand {
  id: string;
  name: string;
  surveyNo: string;
  areaAcres: number;
  ownership: 'Owned' | 'Leased';
  crop?: { name: string; season: string; sown: string };
  /** Geo-tag: boundary captured on a field visit. */
  geo?: { lat: number; lng: number; taggedOn: string; points: number };
  /** A rough plot outline for the drawing, 0–100 units. */
  shape: [number, number][];
}

export interface Farmer {
  id: string;
  name: string;
  phone: string;
  gender: 'Female' | 'Male';
  age: number;
  village: string;
  mandal: string;
  district: string;
  state: string;
  pincode: string;
  address: string;
  registeredOn: string;
  /** Each step of the farmer profile: personal, address, ID, land, crops, bank. */
  steps: { personal: boolean; address: boolean; id: boolean; land: boolean; crops: boolean; bank: boolean };
  lands: FarmerLand[];
  verification: FarmerVerification;
}

/** Identity verification of the farmer. Kisani Urjaa decides; the Didi submits the documents. */
export type VerifyStatus = 'verified' | 'unverified' | 'pending' | 'failed';
export interface FarmerVerification {
  status: VerifyStatus;
  docType?: string;
  idLast4?: string;
  submittedOn?: string;
  decidedOn?: string;
  /** Why Kisani Urjaa could not verify the farmer. */
  reason?: string;
}

export const VERIFY_LABEL: Record<VerifyStatus, string> = { verified: 'Verified', unverified: 'Not verified', pending: 'Verification pending', failed: 'Verification failed' };
export const VERIFY_TONE: Record<VerifyStatus, 'success' | 'warning' | 'danger' | 'neutral'> = { verified: 'success', unverified: 'neutral', pending: 'warning', failed: 'danger' };

export const PROFILE_STEPS: { key: keyof Farmer['steps']; label: string }[] = [
  { key: 'personal', label: 'Personal details' },
  { key: 'address', label: 'Address' },
  { key: 'id', label: 'ID document' },
  { key: 'land', label: 'Land records' },
  { key: 'crops', label: 'Crops' },
  { key: 'bank', label: 'Bank account' },
];

export function completion(f: Farmer): number {
  const done = PROFILE_STEPS.filter((s) => f.steps[s.key]).length;
  return Math.round((done / PROFILE_STEPS.length) * 100);
}

const all = { personal: true, address: true, id: true, land: true, crops: true, bank: true };
const S1: [number, number][] = [[8, 18], [86, 10], [92, 78], [14, 90]];
const S2: [number, number][] = [[12, 12], [70, 8], [94, 46], [76, 92], [10, 80]];
const S3: [number, number][] = [[6, 30], [60, 10], [94, 22], [88, 88], [20, 92]];
const S4: [number, number][] = [[18, 8], [90, 20], [80, 90], [8, 70]];

type Seed = [id: string, name: string, phone: string, gender: 'Female' | 'Male', age: number, village: string, mandal: string, pincode: string, steps: Partial<Farmer['steps']>, lands: FarmerLand[], registered: string];

const land = (id: string, name: string, surveyNo: string, areaAcres: number, crop: FarmerLand['crop'] | undefined, geo: FarmerLand['geo'] | undefined, shape = S1, ownership: FarmerLand['ownership'] = 'Owned'): FarmerLand => ({ id, name, surveyNo, areaAcres, ownership, crop, geo, shape });
const kharif = (name: string, sown = '2026-06-24') => ({ name, season: 'Kharif 2026', sown });
const rabi = (name: string, sown = '2026-11-08') => ({ name, season: 'Rabi 2026–27', sown });

const SEEDS: Seed[] = [
  ['KU-F-10231', DEFAULT_PROFILE.name, DEFAULT_PROFILE.phone, 'Male', 46, 'Ratanpur', 'Buldhana', '443001', all, [land('l1', 'Paddy plot', '112/2', 2.5, kharif('Paddy'), { lat: 20.5312, lng: 76.1824, taggedOn: '2026-06-18', points: 6 }, S1), land('l2', 'Wheat plot', '112/4', 1.5, rabi('Wheat'), { lat: 20.5298, lng: 76.1851, taggedOn: '2026-10-29', points: 5 }, S2)], '2024-06-12'],
  ['KU-F-10244', 'Sunanda Bhagwan Patil', '9000010244', 'Female', 39, 'Ratanpur', 'Buldhana', '443001', { ...all, bank: false }, [land('l1', 'Home field', '87/1', 3, kharif('Cotton', '2026-06-15'), { lat: 20.5341, lng: 76.1792, taggedOn: '2026-06-09', points: 7 }, S3)], '2024-07-03'],
  ['KU-F-10257', 'Ganesh Dattatray Jadhav', '9000010257', 'Male', 52, 'Sakharkherda', 'Sindkhed Raja', '443202', all, [land('l1', 'River side', '204', 4, kharif('Soybean', '2026-06-28'), { lat: 20.1832, lng: 76.1203, taggedOn: '2026-06-21', points: 8 }, S2), land('l2', 'North plot', '206/1', 2, rabi('Chana'), undefined, S4)], '2024-07-19'],
  ['KU-F-10262', 'Kavita Ramesh Wankhede', '9000010262', 'Female', 34, 'Mehkar', 'Mehkar', '443301', { personal: true, address: true, id: true, land: true }, [land('l1', 'Well field', '45/3', 1.75, undefined, undefined, S1)], '2025-01-08'],
  ['KU-F-10278', 'Vitthal Shankar Bhise', '9000010278', 'Male', 61, 'Lonar', 'Lonar', '443302', { personal: true, address: true }, [], '2026-10-22'],
  ['KU-F-10283', 'Manisha Dnyaneshwar Shinde', '9000010283', 'Female', 42, 'Chikhli', 'Chikhli', '443201', all, [land('l1', 'Main field', '310/2', 3.5, kharif('Paddy', '2026-06-30'), { lat: 20.3521, lng: 76.2512, taggedOn: '2026-06-25', points: 6 }, S3)], '2024-08-30'],
  ['KU-F-10291', 'Suresh Namdeo Gawande', '9000010291', 'Male', 48, 'Deulgaon Mahi', 'Deulgaon Raja', '443204', { personal: true, address: true, id: true, land: true, crops: true }, [land('l1', 'East field', '78', 5, kharif('Cotton', '2026-06-12'), { lat: 20.0912, lng: 76.0333, taggedOn: '2026-06-02', points: 9 }, S2)], '2024-09-14'],
  ['KU-F-10305', 'Rekha Prakash Thakare', '9000010305', 'Female', 37, 'Ratanpur', 'Buldhana', '443001', { personal: true, address: true, id: true }, [land('l1', 'Back plot', '115/1', 1.25, undefined, undefined, S4, 'Leased')], '2025-06-21'],
  ['KU-F-10312', 'Prakash Bhimrao Ingle', '9000010312', 'Male', 55, 'Amdapur', 'Chikhli', '443201', all, [land('l1', 'Road field', '19/2', 2.75, rabi('Wheat', '2026-11-12'), { lat: 20.3901, lng: 76.3012, taggedOn: '2026-11-01', points: 5 }, S1)], '2024-10-05'],
  ['KU-F-10326', 'Shobha Vasant Kale', '9000010326', 'Female', 44, 'Mehkar', 'Mehkar', '443301', { personal: true }, [], '2026-11-19'],
  ['KU-F-10334', 'Dnyaneshwar Sitaram More', '9000010334', 'Male', 50, 'Dhad', 'Buldhana', '443106', { ...all, crops: false }, [land('l1', 'Tank field', '63/4', 3.25, undefined, { lat: 20.5891, lng: 76.0102, taggedOn: '2026-09-17', points: 6 }, S3)], '2025-02-11'],
  ['KU-F-10347', 'Anita Gajanan Raut', '9000010347', 'Female', 31, 'Sakharkherda', 'Sindkhed Raja', '443202', all, [land('l1', 'South plot', '221/3', 2, kharif('Soybean', '2026-07-02'), { lat: 20.1799, lng: 76.1288, taggedOn: '2026-06-27', points: 5 }, S4)], '2025-03-27'],
  ['KU-F-10352', 'Ramdas Uttam Pawar', '9000010352', 'Male', 58, 'Lonar', 'Lonar', '443302', { personal: true, address: true, id: true, land: true }, [land('l1', 'Lake road field', '140', 4.5, undefined, undefined, S2)], '2025-08-09'],
  ['KU-F-10368', 'Lata Sudam Wagh', '9000010368', 'Female', 47, 'Chikhli', 'Chikhli', '443201', all, [land('l1', 'Main field', '402/1', 2.25, kharif('Paddy', '2026-06-26'), { lat: 20.3488, lng: 76.2601, taggedOn: '2026-06-20', points: 7 }, S1)], '2024-11-16'],
];

/** Sample verification records (from Kisani Urjaa). Farmers not listed are not verified yet. */
const VERIFIED: Record<string, FarmerVerification> = {
  'KU-F-10231': { status: 'verified', docType: 'Aadhaar', idLast4: '4417', submittedOn: '2024-06-14', decidedOn: '2024-06-16' },
  'KU-F-10244': { status: 'verified', docType: 'Aadhaar', idLast4: '0921', submittedOn: '2024-07-05', decidedOn: '2024-07-08' },
  'KU-F-10262': { status: 'pending', docType: 'Voter ID', idLast4: '7730', submittedOn: '2026-11-25' },
  'KU-F-10283': { status: 'verified', docType: 'Aadhaar', idLast4: '5562', submittedOn: '2024-09-02', decidedOn: '2024-09-04' },
  'KU-F-10291': { status: 'verified', docType: 'PAN card', idLast4: '812K', submittedOn: '2024-09-16', decidedOn: '2024-09-19' },
  'KU-F-10305': { status: 'failed', docType: 'Aadhaar', idLast4: '3308', submittedOn: '2026-11-18', decidedOn: '2026-11-20', reason: 'The Aadhaar photo is blurred and the name can’t be read. Upload a clear photo of the front and back.' },
  'KU-F-10312': { status: 'verified', docType: 'Aadhaar', idLast4: '6190', submittedOn: '2024-10-07', decidedOn: '2024-10-09' },
  'KU-F-10334': { status: 'verified', docType: 'Voter ID', idLast4: '2251', submittedOn: '2025-02-13', decidedOn: '2025-02-17' },
  'KU-F-10347': { status: 'verified', docType: 'Aadhaar', idLast4: '9043', submittedOn: '2025-03-29', decidedOn: '2025-04-01' },
  'KU-F-10368': { status: 'verified', docType: 'Aadhaar', idLast4: '1176', submittedOn: '2024-11-18', decidedOn: '2024-11-21' },
};

export const FARMERS: Farmer[] = SEEDS.map(([id, name, phone, gender, age, village, mandal, pincode, steps, lands, registeredOn]) => ({
  id,
  name,
  phone,
  gender,
  age,
  village,
  mandal,
  district: 'Buldhana',
  state: 'Maharashtra',
  pincode,
  address: `${village}, Tq. ${mandal}`,
  registeredOn,
  steps: { personal: false, address: false, id: false, land: false, crops: false, bank: false, ...steps },
  lands,
  verification: VERIFIED[id] ?? { status: 'unverified' },
}));

export const farmerById = (id: string) => FARMERS.find((f) => f.id.toLowerCase() === id.toLowerCase());

export type FarmerFilter = 'all' | 'incomplete' | 'complete' | 'geo';
export const FARMER_FILTERS: { value: FarmerFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Profile incomplete' },
  { value: 'complete', label: 'Complete' },
  { value: 'geo', label: 'Geo-tag pending' },
];

export const geoPending = (f: Farmer) => f.lands.length === 0 || f.lands.some((l) => !l.geo);

/** Filters from the Farmers filter sheet. */
export interface FarmerFilters {
  verify: VerifyStatus | 'all';
  profile: FarmerFilter;
  village: string;
  /** Registered between these dates (yyyy-mm-dd), inclusive. */
  from?: string;
  to?: string;
}
export const NO_FARMER_FILTERS: FarmerFilters = { verify: 'all', profile: 'all', village: 'all' };

export function activeFarmerFilters(f: FarmerFilters): number {
  return (f.verify !== 'all' ? 1 : 0) + (f.profile !== 'all' ? 1 : 0) + (f.village !== 'all' ? 1 : 0) + (f.from || f.to ? 1 : 0);
}

export function filterFarmers(list: Farmer[], query: string, filter: FarmerFilter | FarmerFilters, village = 'all', verifyOf: (f: Farmer) => VerifyStatus = (f) => f.verification.status): Farmer[] {
  const opts: FarmerFilters = typeof filter === 'string' ? { ...NO_FARMER_FILTERS, profile: filter, village } : filter;
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return list.filter((f) => {
    if (opts.village !== 'all' && f.village !== opts.village) return false;
    if (opts.verify !== 'all' && verifyOf(f) !== opts.verify) return false;
    if (opts.from && f.registeredOn < opts.from) return false;
    if (opts.to && f.registeredOn > opts.to) return false;
    const pf = opts.profile;
    if (pf === 'incomplete' && completion(f) === 100) return false;
    if (pf === 'complete' && completion(f) < 100) return false;
    if (pf === 'geo' && !geoPending(f)) return false;
    if (!q) return true;
    return f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.village.toLowerCase().includes(q) || (digits.length >= 3 && f.phone.includes(digits));
  });
}
