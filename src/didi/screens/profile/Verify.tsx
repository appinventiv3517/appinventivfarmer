import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, Clock, FileCheck2, ScanLine, Upload } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/format';
import { validateDob, validateIdNumber, validatePersonName } from '@/lib/validation';
import { TextField } from '@/d3/ui/Field';
import { Chip, ChipRow, Toggle } from '@/d3/ui/Controls';
import { useToast } from '@/d3/ui/Toast';
import { SuccessMark } from '../../ui/SuccessMark';
import { stepMotion } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Note } from '../../ui/Blocks';
import { Facts } from '../../ui/Kit';
import { didi, getDidi, useDidi } from '../../store';
import s from './Profile.module.css';
import { DateField } from '../../ui/DateField';
import { isoDay } from '../../data/dates';

const DOCS = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN card' },
  { value: 'voter-id', label: 'Voter ID' },
  { value: 'driving-licence', label: 'Driving licence' },
];
const STEPS = ['Document', 'Details', 'Review'];

/** Profile verification: scan or upload an ID, confirm the details, submit for review. */
export default function Verify() {
  const toast = useToast();
  const v = useDidi((st) => st.verification);
  const p = getDidi().profile;
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [docType, setDocType] = useState(v.docType || 'aadhaar');
  const [doc, setDoc] = useState<{ name: string; url?: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState({ idNumber: v.idNumber, fullName: v.fullName || p.name, gender: v.gender || p.gender || 'Female', dob: v.dob || p.dob });
  const [err, setErr] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  const go = (n: number) => (setDir(n > step ? 1 : -1), setStep(n));
  const pick = (f?: File) => {
    if (!f) return;
    setScanning(true);
    const url = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
    setTimeout(() => {
      setScanning(false);
      setDoc({ name: f.name, url });
      toast({ message: 'Document added', tone: 'success' });
    }, 1200);
  };

  const next = () => {
    if (step === 0) {
      if (!doc) return setErr({ doc: 'Scan or upload your document to continue.' });
      return go(1);
    }
    if (step === 1) {
      const e = { idNumber: docType === 'aadhaar' ? (/^\d{12}$/.test(form.idNumber.replace(/\s/g, '')) ? null : 'Aadhaar numbers have 12 digits.') : docType === 'pan' ? (/^[A-Z]{5}\d{4}[A-Z]$/.test(form.idNumber.replace(/\s/g, '').toUpperCase()) ? null : 'PAN has 10 characters, like ABCDE1234F.') : validateIdNumber(docType, form.idNumber), fullName: validatePersonName(form.fullName, 'full name'), dob: form.dob ? validateDob(form.dob) : 'Enter your date of birth.' };
      setErr(e);
      if (Object.values(e).some(Boolean)) return;
      return go(2);
    }
  };
  const submit = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    didi.submitVerification({ docType, idNumber: form.idNumber.replace(/\s/g, '').toUpperCase(), fullName: form.fullName.trim(), gender: form.gender, dob: form.dob, docFile: doc?.name });
    setBusy(false);
  };

  if (v.status !== 'none')
    return (
      <Screen title="Profile verification" backTo="/profile">
        <PageTitle title="Profile verification" />
        <div className={s.sub}>
          <motion.div className={`${s.statusBox} ${v.status === 'verified' ? s.statusOk : ''}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            {v.status === 'verified' ? <BadgeCheck aria-hidden /> : <SuccessMark size={72} label="Submitted" />}
            <strong>{v.status === 'verified' ? 'Your profile is verified' : 'Submitted for review'}</strong>
            <span>{v.status === 'verified' ? 'Thank you. Nothing more is needed.' : `Sent ${v.submittedAt ? formatDateTime(v.submittedAt) : ''}. Kisani Urjaa will check your document and you’ll get a notification.`}</span>
          </motion.div>
          <div className={s.gutter}>
            <Facts
              items={[
                { label: 'Status', value: v.status === 'verified' ? 'Verified' : 'In review' },
                { label: 'Document', value: DOCS.find((d) => d.value === v.docType)?.label },
                { label: 'ID number', value: `••••${v.idNumber.slice(-4)}` },
                { label: 'Full name', value: v.fullName },
                { label: 'Gender', value: v.gender },
                { label: 'Date of birth', value: v.dob ? formatDate(`${v.dob}T00:00`, 'medium') : '' },
              ]}
            />
          </div>
          {v.status === 'submitted' && (
            <div className={s.gutter}>
              <Note tone="info" icon={<Clock aria-hidden />}>
                In this prototype, Profile → Prototype controls can mark the review as complete.
              </Note>
            </div>
          )}
        </div>
      </Screen>
    );

  return (
    <Screen
      title="Profile verification"
      backTo="/profile"
      footer={
        <div className={s.footRow}>
          {step > 0 && (
            <Button size="lg" variant="secondary" icon={<ArrowLeft aria-hidden />} onClick={() => go(step - 1)} aria-label="Previous step" />
          )}
          {step < 2 ? (
            <Button size="lg" block iconRight={<ArrowRight aria-hidden />} onClick={next}>
              Continue
            </Button>
          ) : (
            <Button size="lg" block icon={<FileCheck2 aria-hidden />} onClick={submit} loading={busy}>
              Submit for verification
            </Button>
          )}
        </div>
      }
    >
      <PageTitle kicker={`Step ${step + 1} of 3 · ${STEPS[step]}`} title="Verify your identity" />
      <ol className={s.stepper} aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? s.stepDone : i === step ? s.stepOn : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{i < step ? <Check aria-hidden /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div key={step} className={`${s.formEdit} didi-wrap-chips`} {...stepMotion(dir)}>
          {step === 0 && (
            <>
              <p className={s.groupLabel}>Document type</p>
              <ChipRow label="Document type">
                {DOCS.map((d) => (
                  <Chip key={d.value} selected={docType === d.value} onClick={() => (setDocType(d.value), setErr({}))}>
                    {d.label}
                  </Chip>
                ))}
              </ChipRow>
              <div className={`${s.docBox} ${err.doc ? s.docErr : ''}`}>
                {scanning ? (
                  <div className={s.docScan}>
                    <ScanLine aria-hidden />
                    <motion.span className={s.docLine} animate={{ top: ['10%', '85%', '10%'] }} transition={{ duration: 1.6, repeat: Infinity }} />
                    <strong>Reading your document…</strong>
                  </div>
                ) : doc ? (
                  <div className={s.docDone}>
                    {doc.url ? <img src={doc.url} alt="Your document" /> : <FileCheck2 aria-hidden />}
                    <span>
                      <strong>{DOCS.find((d) => d.value === docType)?.label} added</strong>
                      <small>{doc.name}</small>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setDoc(null)}>
                      Replace
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className={s.docHint}>Place the front of your {DOCS.find((d) => d.value === docType)?.label} on a flat surface in good light. All four corners should be visible.</p>
                    <div className={s.grid2}>
                      <Button icon={<Camera aria-hidden />} onClick={() => camera.current?.click()}>
                        Scan
                      </Button>
                      <Button variant="secondary" icon={<Upload aria-hidden />} onClick={() => file.current?.click()}>
                        Upload
                      </Button>
                    </div>
                  </>
                )}
                <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (pick(e.target.files?.[0]), setErr({}), (e.target.value = ''))} />
                <input ref={file} type="file" accept="image/*,.pdf" hidden onChange={(e) => (pick(e.target.files?.[0]), setErr({}), (e.target.value = ''))} />
              </div>
              {err.doc && <p className={s.err}>{err.doc}</p>}
              <button type="button" className={s.demoLink} onClick={() => pick(new File(['demo'], `${docType}-front.jpg`, { type: 'text/plain' }))}>
                Demo: use a sample document
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <TextField label={`${DOCS.find((d) => d.value === docType)?.label} number`} required value={form.idNumber} onChange={(e) => (setForm({ ...form, idNumber: e.target.value }), setErr({ ...err, idNumber: null }))} error={err.idNumber} autoCapitalize="characters" inputMode={docType === 'aadhaar' ? 'numeric' : 'text'} placeholder={docType === 'aadhaar' ? '1234 5678 9012' : docType === 'pan' ? 'ABCDE1234F' : ''} />
              <TextField label="Full name (as on the document)" required value={form.fullName} onChange={(e) => (setForm({ ...form, fullName: e.target.value }), setErr({ ...err, fullName: null }))} error={err.fullName} />
              <div>
                <p className={s.groupLabel}>Gender</p>
                <Toggle label="Gender" value={form.gender} onChange={(g) => setForm({ ...form, gender: g })} options={[{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }, { value: 'Other', label: 'Other' }]} />
              </div>
              <DateField label="Date of birth" required value={form.dob} min="1926-01-01" max={isoDay(new Date())} onChange={(v) => (setForm({ ...form, dob: v }), setErr({ ...err, dob: null }))} error={err.dob} />
            </>
          )}
          {step === 2 && (
            <>
              <Facts
                items={[
                  { label: 'Document', value: `${DOCS.find((d) => d.value === docType)?.label} · ${doc?.name}` },
                  { label: 'ID number', value: form.idNumber.toUpperCase() },
                  { label: 'Full name', value: form.fullName },
                  { label: 'Gender', value: form.gender },
                  { label: 'Date of birth', value: formatDate(`${form.dob}T00:00`, 'medium') },
                ]}
              />
              <Note tone="neutral">Check that these match your document. You can’t change them while the review is in progress.</Note>
              <button type="button" className={s.demoLink} onClick={() => go(1)}>
                Edit details
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Screen>
  );
}
