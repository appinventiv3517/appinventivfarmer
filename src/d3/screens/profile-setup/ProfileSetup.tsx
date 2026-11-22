import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Camera, FileText, GraduationCap, Home as HomeIcon, Landmark, Mail, MapPin, Phone, ScanLine, Trash2, User, UserCheck, Users, CircleCheck } from 'lucide-react';
import { actions, getState, useStore, type ProfileDetails } from '@/services/store';
import { KISANI_DIDI } from '@/data/people';
import { DISTRICTS, MANDALS, STATES, stateForPincode } from '@/data/places';
import { validateDob, validateEmail, validateIdNumber, validatePersonName, validatePhone, validatePincode, validatePlaceName } from '@/lib/validation';
import { formatPhone } from '@/lib/format';
import { Screen } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { TextArea, TextField } from '../../ui/Field';
import { useToast } from '../../ui/Toast';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { Done } from '../onboarding/Done';
import { InfoTip, formatMobile } from '../onboarding/fields';
import { PickerField, type PickOption } from './Picker';
import s from './ProfileSetup.module.css';
import o from '../onboarding/Onboarding.module.css';

const STEPS = ['Personal details', 'Address details', 'Additional details'] as const;

export const DOC_TYPES: PickOption[] = [
  { value: 'voter-id', label: 'Voter ID' },
  { value: 'driving-licence', label: 'Driving Licence' },
  { value: 'kisan-card', label: 'Kisan Card' },
  { value: 'ration-card', label: 'Ration Card' },
];
const DOC_SHORT: Record<string, string> = { 'voter-id': 'Voter ID', 'driving-licence': 'DL', 'kisan-card': 'Kisan Card', 'ration-card': 'Ration Card' };

export const EDUCATION: PickOption[] = ['No formal education', 'Primary education', 'Middle school', 'High school', 'Diploma', 'Bachelor’s degree', 'Master’s degree'].map((l) => ({ value: l, label: l }));

const DIDIS: PickOption[] = [KISANI_DIDI].map((d) => ({
  value: d.id ?? d.name,
  label: d.name,
  sub: (
    <>
      <span className={s.idTag}>#{d.id}</span> {formatPhone(d.phone)} · {d.area}
    </>
  ),
  keywords: `${d.id} ${d.phone}`,
}));

/** Profile completion shown in the header card. */
export function completion(d: ProfileDetails, step: number): number {
  if (step === 1) return 20;
  if (step === 2) return 40;
  const extras = [d.photo, d.relationName, d.altPhone, d.email, d.education].filter(Boolean).length;
  return 70 + extras * 6;
}

/** Scanned ID images stay in memory for this visit only; they are never stored on the device. */
const scans = new Map<string, string>();

function Progress({ step, percent }: { step: number; percent: number }) {
  const segFill = (n: number) => (n < step ? 1 : n > step ? 0 : step === 3 ? Math.min(1, (percent - 70) / 30 + 0.34) : 0.34);
  return (
    <div className={s.progress} role="group" aria-label="Profile progress">
      <p className={s.percent}>
        <strong>{percent}%</strong> profile complete
      </p>
      <p className={s.stepLine}>
        <span>{STEPS[step - 1]}</span>
        <span className={s.stepCount}>Step {step} of 3</span>
      </p>
      <div className={s.segments} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${percent}% profile complete`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={s.segment}>
            <motion.span className={s.segmentFill} initial={false} animate={{ scaleX: segFill(n) }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          </span>
        ))}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.card} aria-label={title}>
      <h2 className={s.cardTitle}>{title}</h2>
      <div className={s.cardBody}>{children}</div>
    </section>
  );
}

function Ico({ children }: { children: ReactNode }) {
  return <span className={o.fieldIcon}>{children}</span>;
}

function Req({ children }: { children: string }) {
  return (
    <>
      {children}
      <span className={s.req}> *</span>
    </>
  );
}

/** Front / back photo of the ID: camera on phones, file picker elsewhere. JPEG or PNG up to 5 MB. */
function ScanTile({ side, docType, onError }: { side: 'front' | 'back'; docType: string; onError: (msg: string) => void }) {
  const key = `${docType}:${side}`;
  const [url, setUrl] = useState(() => scans.get(key) ?? '');
  const [bad, setBad] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  useEffect(() => setUrl(scans.get(key) ?? ''), [key]);
  const pick = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setBad(true);
      onError('Unable to preview document. Please re-upload.');
      return;
    }
    const u = URL.createObjectURL(file);
    scans.set(key, u);
    setUrl(u);
    setBad(false);
    // No document reading in this prototype: say so, as the design's failure state does.
    if (side === 'front') toast({ message: 'Could not read details. Please enter manually.', tone: 'info' });
  };
  const label = `${side === 'front' ? 'Front' : 'Back'} side of ${DOC_SHORT[docType] ?? 'document'}`;
  return (
    <div className={`${s.scan} ${url ? s.scanDone : ''} ${bad ? s.scanBad : ''}`}>
      <span className={s.scanTag}>{side === 'front' ? 'Front side' : 'Back side'}</span>
      {url ? (
        <>
          <img src={url} alt={`${label}, uploaded`} className={s.scanThumb} />
          <span className={s.scanTitle}>
            <CircleCheck aria-hidden /> File uploaded
          </span>
          <button
            type="button"
            className={s.scanDelete}
            aria-label={`Remove ${label}`}
            onClick={() => {
              scans.delete(key);
              setUrl('');
            }}
          >
            <Trash2 aria-hidden />
          </button>
        </>
      ) : (
        <button type="button" className={s.scanBtn} onClick={() => input.current?.click()}>
          <ScanLine aria-hidden />
          <span className={s.scanTitle}>Tap to scan</span>
          <span className={s.scanSub}>{label}</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  );
}

/** Resize a chosen photo to a small square JPEG so it fits in device storage. */
function toSmallJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 320;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const min = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

type Errors = Partial<Record<keyof ProfileDetails | 'scan', string | null>>;

export default function ProfileSetup() {
  const nav = useNav();
  const toast = useToast();
  const { step: raw } = useParams();
  const step = Math.min(3, Math.max(1, Number(raw) || 1));
  const saved = useStore((st) => st.profileDetails);
  const [d, setD] = useState<ProfileDetails>(() => ({ ...saved, fullName: saved.fullName || '' }));
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ProfileDetails>(k: K, v: ProfileDetails[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };
  const finish = useCallback(() => nav('/home', { replace: true }), [nav]);

  const autoState = stateForPincode(d.pincode);
  useEffect(() => {
    if (autoState && autoState !== d.state) setD((x) => ({ ...x, state: autoState, district: '', mandal: '', otherMandal: '' }));
  }, [autoState, d.state]);

  const percent = useMemo(() => completion(d, step), [d, step]);

  if (done) return <Done icon={<UserCheck />} title="Profile complete" text="Thank you. Your Kisani Didi will check your details and verify your profile." action="Go to Home" onContinue={finish} auto={false} />;
  // Steps open in order.
  if (step > saved.completed + 1) return <Navigate to={to(`/profile/setup/${saved.completed + 1}`)} replace />;

  const districts = DISTRICTS[d.state];
  const mandals = MANDALS[d.district];

  const validate = (): Errors => {
    const e: Errors = {};
    if (step === 1) {
      if (!d.docType) e.docType = 'Choose an identity document.';
      else {
        if (!scans.get(`${d.docType}:front`)) e.scan = 'Scan or upload the front side.';
        e.idNumber = validateIdNumber(d.docType, d.idNumber);
      }
      e.fullName = validatePersonName(d.fullName, 'full name');
      e.dob = validateDob(d.dob);
    }
    if (step === 2) {
      if (d.address.trim().length < 6) e.address = d.address.trim() ? 'Add a little more: house, street or landmark.' : 'Enter your complete address.';
      e.pincode = validatePincode(d.pincode);
      if (!d.state) e.state = 'Choose your state.';
      e.district = districts ? (d.district ? null : 'Choose your district.') : validatePlaceName(d.district, 'district');
      e.mandal = mandals ? (d.mandal ? null : 'Choose your mandal.') : validatePlaceName(d.mandal, 'mandal');
      if (d.mandal === 'Other') e.otherMandal = validatePlaceName(d.otherMandal, 'mandal');
      e.village = validatePlaceName(d.village, 'village');
    }
    if (step === 3) {
      if (d.relationName.trim()) e.relationName = validatePersonName(d.relationName, 'name');
      if (d.altPhone) e.altPhone = validatePhone(d.altPhone) ?? (d.altPhone.replace(/\D/g, '') === getState().account?.phone ? 'Use a different number from your own.' : null);
      e.email = validateEmail(d.email);
      if (!d.education) e.education = 'Choose your highest education.';
    }
    return e;
  };

  const next = () => {
    const e = validate();
    setErrors(e);
    const first = Object.entries(e).find(([, v]) => v);
    if (first) {
      toast({ message: first[1] as string, tone: 'error' });
      return;
    }
    const patch: ProfileDetails = { ...d, idNumber: d.idNumber.replace(/\s/g, '').toUpperCase(), altPhone: d.altPhone.replace(/\D/g, ''), completed: Math.max(saved.completed, step) };
    actions.saveProfileDetails(patch);
    if (step < 3) {
      nav(`/profile/setup/${step + 1}`);
      return;
    }
    const st = getState();
    actions.updateProfile({
      name: d.fullName.trim(),
      village: d.village.trim(),
      taluka: d.mandal === 'Other' ? d.otherMandal.trim() : d.mandal,
      district: d.district.trim(),
      state: d.state,
      pincode: d.pincode,
      username: st.account?.userId ?? st.profile.username,
    });
    setDone(true);
  };

  return (
    <Screen
      title="Profile details"
      back={step > 1}
      backTo={`/profile/setup/${step - 1}`}
      footer={
        <Button size="lg" block onClick={next}>
          {step < 3 ? 'Continue' : 'Submit'}
        </Button>
      }
    >
      <div className={s.page}>
        <Progress step={step} percent={percent} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} className={s.stack} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            {step === 1 && (
              <>
                <PickerField label="My Kisani Didi" value={d.didiId} onChange={(v) => set('didiId', v)} options={DIDIS} placeholder="Select Kisani Didi" sheetTitle="Select Kisani Didi" search="Search by name, ID or mobile number" icon={<Users aria-hidden />} hint="Your local Kisani Didi helps you with orders and bookings." />
                <div className={s.group}>
                  <h2 className={s.groupTitle}>
                    <Req>Profile verification</Req>
                  </h2>
                  <p className={s.groupText}>Choose a personal identification document to upload.</p>
                  <PickerField
                    label="Document"
                    value={d.docType}
                    onChange={(v) => (set('docType', v), set('idNumber', ''), setErrors((x) => ({ ...x, scan: null })))}
                    options={DOC_TYPES}
                    placeholder="Select document"
                    sheetTitle="Select document"
                    sheetText="Choose a KYC document to upload."
                    icon={<FileText aria-hidden />}
                    error={errors.docType}
                  />
                  {d.docType && (
                    <>
                      <div className={s.scans}>
                        <ScanTile side="front" docType={d.docType} onError={(m) => toast({ message: m, tone: 'error' })} />
                        <ScanTile side="back" docType={d.docType} onError={(m) => toast({ message: m, tone: 'error' })} />
                      </div>
                      {errors.scan && <p className={s.inlineErr} role="alert">{errors.scan}</p>}
                      <p className={s.scanNote}>JPEG or PNG, up to 5 MB. Images are used for this check only and are not kept on your phone.</p>
                      <TextField label="ID number" required prefix={<Ico><Landmark aria-hidden /></Ico>} placeholder="Enter ID number" autoCapitalize="characters" value={d.idNumber} onChange={(e) => set('idNumber', e.target.value.toUpperCase())} error={errors.idNumber} />
                    </>
                  )}
                </div>
                <Card title="Farmer details">
                  <TextField label="Full name" required prefix={<Ico><User aria-hidden /></Ico>} placeholder="Enter full name" autoComplete="name" value={d.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} />
                  <fieldset className={s.choice}>
                    <legend className={s.legend}>
                      Gender <span className={s.optional}>Optional</span>
                    </legend>
                    <div className={s.choiceRow}>
                      {(['male', 'female'] as const).map((g) => (
                        <label key={g} className={`${s.choiceTile} ${d.gender === g ? s.choiceOn : ''}`}>
                          <input type="radio" name="gender" value={g} checked={d.gender === g} onChange={() => set('gender', g)} />
                          {g === 'male' ? 'Male' : 'Female'}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <TextField label="Date of birth" optional type="date" prefix={<Ico><Calendar aria-hidden /></Ico>} max={new Date().toISOString().slice(0, 10)} value={d.dob} onChange={(e) => set('dob', e.target.value)} error={errors.dob} />
                </Card>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className={s.groupTitle}>Home address details</h2>
                <TextArea label="Complete address" required placeholder="House number, street, landmark" maxLength={200} value={d.address} onChange={(e) => set('address', e.target.value)} error={errors.address} autoComplete="street-address" />
                <TextField label="PIN code" required prefix={<Ico><MapPin aria-hidden /></Ico>} placeholder="Enter PIN code" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={d.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} error={errors.pincode} />
                {autoState ? (
                  <TextField label="State" required readOnly prefix={<Ico><Landmark aria-hidden /></Ico>} value={d.state} hint="Filled in from your PIN code." />
                ) : (
                  <PickerField label="State" required value={d.state} onChange={(v) => (set('state', v), set('district', ''), set('mandal', ''))} options={STATES.map((x) => ({ value: x, label: x }))} placeholder="Select state" search="Search state" icon={<Landmark aria-hidden />} error={errors.state} hint={d.pincode.length === 6 ? undefined : 'Enter your PIN code to fill this in.'} />
                )}
                {districts ? (
                  <PickerField label="District" required value={d.district} onChange={(v) => (set('district', v), set('mandal', ''), set('otherMandal', ''))} options={districts.map((x) => ({ value: x, label: x }))} placeholder="Select district" search="Search district" icon={<Landmark aria-hidden />} error={errors.district} />
                ) : (
                  <TextField label="District" required prefix={<Ico><Landmark aria-hidden /></Ico>} placeholder="Enter district" value={d.district} onChange={(e) => set('district', e.target.value)} error={errors.district} />
                )}
                {mandals ? (
                  <PickerField label="Mandal" required value={d.mandal} onChange={(v) => (set('mandal', v), v !== 'Other' && set('otherMandal', ''))} options={[...mandals, 'Other'].map((x) => ({ value: x, label: x }))} placeholder="Select mandal" search="Search mandal" icon={<Users aria-hidden />} error={errors.mandal} />
                ) : (
                  <TextField label="Mandal" required prefix={<Ico><Users aria-hidden /></Ico>} placeholder="Enter mandal" value={d.mandal} onChange={(e) => set('mandal', e.target.value)} error={errors.mandal} />
                )}
                {d.mandal === 'Other' && <TextField label="Other mandal name" required prefix={<Ico><Users aria-hidden /></Ico>} placeholder="Enter mandal name" value={d.otherMandal} onChange={(e) => set('otherMandal', e.target.value)} error={errors.otherMandal} />}
                <TextField label="Village" required prefix={<Ico><HomeIcon aria-hidden /></Ico>} placeholder="Enter village" autoComplete="address-level3" value={d.village} onChange={(e) => set('village', e.target.value)} error={errors.village} />
              </>
            )}

            {step === 3 && (
              <>
                <div className={s.photoCard}>
                  <button type="button" className={s.avatarBtn} onClick={() => photoInput.current?.click()} aria-label={d.photo ? 'Change profile photo' : 'Upload profile photo'}>
                    {d.photo ? <img src={d.photo} alt="" /> : <User aria-hidden className={s.avatarIcon} />}
                    <span className={s.avatarBadge} aria-hidden>
                      <Camera />
                    </span>
                  </button>
                  <span className={s.photoLabel}>{d.photo ? 'Change profile photo' : 'Upload profile photo'}</span>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="user"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) return toast({ message: 'Choose a JPEG or PNG photo up to 5 MB.', tone: 'error' });
                      try {
                        set('photo', await toSmallJpeg(file));
                      } catch {
                        toast({ message: 'Could not open that photo. Try another.', tone: 'error' });
                      }
                    }}
                  />
                </div>
                <Card title="Additional details">
                  <fieldset className={s.choice}>
                    <legend className={s.legend}>Whose name will you add?</legend>
                    <div className={s.radioRow}>
                      {(['father', 'spouse'] as const).map((r) => (
                        <label key={r} className={s.radio}>
                          <input type="radio" name="relation" checked={d.relation === r} onChange={() => set('relation', r)} />
                          {r === 'father' ? 'Father' : 'Spouse'}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <TextField label={d.relation === 'father' ? 'Father’s name' : 'Spouse’s name'} optional prefix={<Ico><User aria-hidden /></Ico>} placeholder={d.relation === 'father' ? 'Enter father’s name' : 'Enter spouse’s name'} value={d.relationName} onChange={(e) => set('relationName', e.target.value)} error={errors.relationName} />
                  <div>
                    <TextField aside={<InfoTip label="About alternate mobile number" text="You can also add a family member’s mobile number" />} label="Alternate mobile number" optional type="tel" inputMode="numeric" prefix={<Ico><Phone aria-hidden /></Ico>} placeholder="Enter mobile number" value={d.altPhone} onChange={(e) => set('altPhone', formatMobile(e.target.value))} error={errors.altPhone} />
                  </div>
                  <TextField label="Email ID" optional type="email" inputMode="email" autoComplete="email" prefix={<Ico><Mail aria-hidden /></Ico>} placeholder="Enter email ID" value={d.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
                </Card>
                <Card title="Educational details">
                  <PickerField label="Highest education" required value={d.education} onChange={(v) => set('education', v)} options={EDUCATION} placeholder="Select education level" sheetTitle="Educational details" icon={<GraduationCap aria-hidden />} error={errors.education} />
                </Card>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Screen>
  );
}
