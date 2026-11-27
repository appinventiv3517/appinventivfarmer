import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Camera, Check, FileCheck2, FileText, Upload, X } from 'lucide-react';
import { validatePersonName } from '@/lib/validation';
import { TextField } from '@/d3/ui/Field';
import { Chip } from '@/d3/ui/Controls';
import { useToast } from '@/d3/ui/Toast';
import { stepMotion } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { EmptyState, Note } from '../../ui/Blocks';
import { Facts } from '../../ui/Kit';
import { SuccessMark } from '../../ui/SuccessMark';
import { didi, useFarmerVerification } from '../../store';
import { farmerById } from '../../data/farmers';
import { useNav } from '../../nav';
import ps from '../profile/Profile.module.css';
import s from './Farmers.module.css';

const DOCS = [
  { value: 'Aadhaar', hint: '12 digits', back: true },
  { value: 'Voter ID', hint: '10 characters, like ABC1234567', back: true },
  { value: 'PAN card', hint: '10 characters, like ABCDE1234F', back: false },
  { value: 'Driving licence', hint: 'As printed on the licence', back: true },
];
const STEPS = ['Details', 'Documents', 'Review'];
type Slot = 'front' | 'back' | 'photo';
type Upload = { name: string; url?: string; size: number };

function checkId(doc: string, raw: string): string | null {
  const v = raw.replace(/\s/g, '').toUpperCase();
  if (!v) return 'Enter the document number.';
  if (doc === 'Aadhaar') return /^\d{12}$/.test(v) ? null : 'Aadhaar numbers have 12 digits.';
  if (doc === 'PAN card') return /^[A-Z]{5}\d{4}[A-Z]$/.test(v) ? null : 'PAN has 10 characters, like ABCDE1234F.';
  if (doc === 'Voter ID') return /^[A-Z]{3}\d{7}$/.test(v) ? null : 'Voter ID has 3 letters and 7 digits.';
  return v.length >= 8 ? null : 'Enter the full licence number.';
}

/** One upload slot: take a photo or pick a file, see a preview, remove it. */
function UploadSlot({ label, hint, value, onChange, error }: { label: string; hint: string; value?: Upload; onChange: (u?: Upload) => void; error?: string | null }) {
  const cam = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast({ message: `${f.name} is over 10 MB. Choose a smaller file.`, tone: 'error' });
    onChange({ name: f.name, size: f.size, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined });
  };
  return (
    <div className={`${s.slot} ${error ? s.slotErr : ''}`}>
      <div className={s.slotHead}>
        <strong>{label}</strong>
        <small>{hint}</small>
      </div>
      {value ? (
        <div className={s.slotFile}>
          {value.url ? <img src={value.url} alt={label} /> : <span className={s.slotDoc}><FileText aria-hidden /></span>}
          <span>
            <strong>{value.name}</strong>
            <small>{Math.max(1, Math.round(value.size / 1024))} KB</small>
          </span>
          <button type="button" className={s.slotRemove} onClick={() => onChange(undefined)} aria-label={`Remove ${label.toLowerCase()}`}>
            <X aria-hidden />
          </button>
        </div>
      ) : (
        <div className={s.slotBtns}>
          <Button size="sm" icon={<Camera aria-hidden />} onClick={() => cam.current?.click()}>
            Take photo
          </Button>
          <Button size="sm" variant="secondary" icon={<Upload aria-hidden />} onClick={() => file.current?.click()}>
            Upload
          </Button>
        </div>
      )}
      {error && <p className={ps.err}>{error}</p>}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={file} type="file" accept="image/*,.pdf" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  );
}

/** Verify a farmer: document details, document photos, review and submit. Kisani Urjaa decides. */
export default function FarmerVerify() {
  const { id = '' } = useParams();
  const f = farmerById(id);
  const v = useFarmerVerification(f);
  const nav = useNav();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [doc, setDoc] = useState(v?.status === 'failed' && v.docType ? v.docType : 'Aadhaar');
  const [idNo, setIdNo] = useState('');
  const [name, setName] = useState(f?.name ?? '');
  const [files, setFiles] = useState<Partial<Record<Slot, Upload>>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!f || !v)
    return (
      <Screen title="Verify farmer" backTo="/farmers">
        <EmptyState animation="search" title="Farmer not found" body={`No farmer with ID ${id} is registered in your cluster.`} action={<Button to="/farmers">See all farmers</Button>} />
      </Screen>
    );
  const back = `/farmers/${f.id}`;
  if (!sent && (v.status === 'verified' || v.status === 'pending'))
    return (
      <Screen title="Verify farmer" backTo={back}>
        <EmptyState animation="records" title={v.status === 'verified' ? `${f.name.split(' ')[0]} is already verified` : 'Verification is pending'} body={v.status === 'verified' ? 'Nothing more is needed.' : 'Kisani Urjaa is checking the documents already sent.'} action={<Button to={back}>Back to farmer</Button>} />
      </Screen>
    );

  const info = DOCS.find((d) => d.value === doc)!;
  const go = (n: number) => (setDir(n > step ? 1 : -1), setStep(n));
  const next = () => {
    if (step === 0) {
      const e = { idNo: checkId(doc, idNo), name: validatePersonName(name, 'name') };
      setErr(e);
      if (!Object.values(e).some(Boolean)) go(1);
      return;
    }
    if (step === 1) {
      const e = { front: files.front ? null : 'Add a photo of the front.', back: info.back && !files.back ? 'Add a photo of the back.' : null };
      setErr(e);
      if (!Object.values(e).some(Boolean)) go(2);
    }
  };
  const submit = async () => {
    if (!confirmed) return setErr({ confirm: 'Confirm that you checked the document with the farmer.' });
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1000));
    didi.submitFarmerVerification(f.id, { docType: doc, idLast4: idNo.replace(/\s/g, '').toUpperCase().slice(-4) });
    setBusy(false);
    setSent(true);
  };

  if (sent)
    return (
      <Screen title="Verify farmer" backTo={back} footer={<Button size="lg" block onClick={() => nav(back, { replace: true })}>Back to {f.name.split(' ')[0]}’s profile</Button>}>
        <div className={ps.sub}>
          <motion.div className={ps.statusBox} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <SuccessMark size={72} label="Sent" />
            <strong>Sent for verification</strong>
            <span>Kisani Urjaa will check {f.name.split(' ')[0]}’s {doc}. You’ll get a notification with the result.</span>
          </motion.div>
          <div className={ps.gutter}>
            <Facts items={[{ label: 'Farmer', value: `${f.name} · ${f.id}` }, { label: 'Document', value: `${doc} ending ${idNo.replace(/\s/g, '').toUpperCase().slice(-4)}` }, { label: 'Status', value: 'Verification pending' }]} />
          </div>
        </div>
      </Screen>
    );

  return (
    <Screen
      title="Verify farmer"
      backTo={back}
      footer={
        <div className={ps.footRow}>
          {step > 0 && <Button size="lg" variant="secondary" icon={<ArrowLeft aria-hidden />} onClick={() => go(step - 1)} aria-label="Previous step" />}
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
      <PageTitle kicker={`Step ${step + 1} of 3 · ${STEPS[step]}`} title={`Verify ${f.name.split(' ')[0]}`} deck={`${f.name} · ${f.id} · ${f.village}`} />
      <ol className={ps.stepper} aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? ps.stepDone : i === step ? ps.stepOn : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{i < step ? <Check aria-hidden /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div key={step} className={ps.formEdit} {...stepMotion(dir)}>
          {step === 0 && (
            <>
              {v.status === 'failed' && v.reason && (
                <Note tone="danger" title="Why the last attempt failed">
                  {v.reason}
                </Note>
              )}
              <p className={ps.groupLabel}>ID document</p>
              <div className={s.docChips} role="group" aria-label="ID document">
                {DOCS.map((d) => (
                  <Chip key={d.value} selected={doc === d.value} onClick={() => (setDoc(d.value), setErr({}))}>
                    {d.value}
                  </Chip>
                ))}
              </div>
              <TextField label={`${doc} number`} required value={idNo} hint={info.hint} onChange={(e) => (setIdNo(e.target.value), setErr({ ...err, idNo: null }))} error={err.idNo} autoCapitalize="characters" inputMode={doc === 'Aadhaar' ? 'numeric' : 'text'} />
              <TextField label="Farmer’s name (as on the document)" required value={name} onChange={(e) => (setName(e.target.value), setErr({ ...err, name: null }))} error={err.name} />
            </>
          )}
          {step === 1 && (
            <>
              <p className={s.slotIntro}>Photograph the document on a flat surface in good light, with all four corners visible.</p>
              <UploadSlot label="Front of the document" hint="Required" value={files.front} onChange={(u) => (setFiles({ ...files, front: u }), setErr({ ...err, front: null }))} error={err.front} />
              {info.back && <UploadSlot label="Back of the document" hint="Required" value={files.back} onChange={(u) => (setFiles({ ...files, back: u }), setErr({ ...err, back: null }))} error={err.back} />}
              <UploadSlot label="Farmer holding the document" hint="Optional" value={files.photo} onChange={(u) => setFiles({ ...files, photo: u })} />
              <button type="button" className={ps.demoLink} onClick={() => setFiles({ front: { name: `${doc.toLowerCase().replace(/\s/g, '-')}-front.jpg`, size: 412_000 }, ...(info.back ? { back: { name: `${doc.toLowerCase().replace(/\s/g, '-')}-back.jpg`, size: 398_000 } } : {}) })}>
                Demo: use sample document photos
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <Facts
                items={[
                  { label: 'Farmer', value: `${f.name} · ${f.id}` },
                  { label: 'Document', value: doc },
                  { label: 'Number', value: `••••${idNo.replace(/\s/g, '').toUpperCase().slice(-4)}` },
                  { label: 'Name on document', value: name.trim() },
                  { label: 'Photos', value: [files.front && 'Front', files.back && 'Back', files.photo && 'Farmer with document'].filter(Boolean).join(', ') },
                ]}
              />
              <label className={`${s.confirm} ${err.confirm ? s.confirmErr : ''}`}>
                <input type="checkbox" checked={confirmed} onChange={(e) => (setConfirmed(e.target.checked), setErr({}))} />
                <span>I checked the original document with {f.name.split(' ')[0]} in person, and the details match.</span>
              </label>
              {err.confirm && <p className={ps.err}>{err.confirm}</p>}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Screen>
  );
}
