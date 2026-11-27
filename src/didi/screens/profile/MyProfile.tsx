import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, Circle, Pencil } from 'lucide-react';
import { formatDate, formatPhone, initials } from '@/lib/format';
import { validateDob, validateEmail, validatePersonName, validatePincode, validatePlaceName } from '@/lib/validation';
import { TextField } from '@/d3/ui/Field';
import { Toggle } from '@/d3/ui/Controls';
import { useToast } from '@/d3/ui/Toast';
import { SWAP } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Facts, Ring, Section } from '../../ui/Kit';
import { didi, useDidi } from '../../store';
import type { DidiProfile } from '../../data/didi';
import { profileItems, profilePct } from './profileCompletion';
import s from './Profile.module.css';
import { DateField } from '../../ui/DateField';
import { isoDay } from '../../data/dates';

type Errors = Partial<Record<keyof DidiProfile, string | null>>;

export default function MyProfile() {
  const toast = useToast();
  const p = useDidi((st) => st.profile);
  const v = useDidi((st) => st.verification);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(p);
  const [err, setErr] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const pct = profilePct(p, v);
  const set = (k: keyof DidiProfile, val: string) => (setForm((f) => ({ ...f, [k]: val })), setErr((e) => ({ ...e, [k]: null })));

  const pickPhoto = (f?: File) => {
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const size = 320;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const m = Math.min(img.width, img.height);
      c.getContext('2d')?.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      URL.revokeObjectURL(url);
      didi.saveProfile({ photo: c.toDataURL('image/jpeg', 0.8) });
      setForm((x) => ({ ...x, photo: c.toDataURL('image/jpeg', 0.8) }));
      toast({ message: 'Profile photo updated', tone: 'success' });
    };
    img.onerror = () => toast({ message: 'That file isn’t a photo we can read.', tone: 'error' });
    img.src = url;
  };

  const save = async () => {
    const next: Errors = {
      name: validatePersonName(form.name, 'full name'),
      email: form.email ? validateEmail(form.email) : null,
      dob: validateDob(form.dob),
      village: validatePlaceName(form.village, 'village'),
      mandal: validatePlaceName(form.mandal, 'mandal'),
      district: validatePlaceName(form.district, 'district'),
      pincode: validatePincode(form.pincode),
    };
    setErr(next);
    if (Object.values(next).some(Boolean)) return toast({ message: 'Check the highlighted fields.', tone: 'error' });
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    didi.saveProfile({ ...form, name: form.name.trim() });
    setBusy(false);
    setEdit(false);
    toast({ message: 'Profile saved', tone: 'success' });
  };

  return (
    <Screen
      title="My profile"
      backTo="/profile"
      actions={!edit && (
        <Button size="sm" variant="tonal" icon={<Pencil aria-hidden />} onClick={() => (setForm(p), setEdit(true))}>
          Edit
        </Button>
      )}
      footer={
        edit ? (
          <div className={s.footRow}>
            <Button size="lg" variant="secondary" onClick={() => (setEdit(false), setErr({}))}>
              Cancel
            </Button>
            <Button size="lg" block onClick={save} loading={busy}>
              Save changes
            </Button>
          </div>
        ) : undefined
      }
    >
      <PageTitle kicker={`${p.role} · ${p.partnerId}`} title={p.name} />
      <div className={s.sub}>
        <div className={s.photoRow}>
          <button type="button" className={s.bigPhoto} onClick={() => file.current?.click()} aria-label="Change profile photo">
            {p.photo ? <img src={p.photo} alt="" /> : <span>{initials(p.name)}</span>}
            <span className={s.cam}>
              <Camera aria-hidden />
            </span>
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => (pickPhoto(e.target.files?.[0]), (e.target.value = ''))} />
          <div className={s.completion}>
            <Ring value={pct} size={64} stroke={6} label={`Profile ${pct}% complete`} tone={pct === 100 ? 'green' : 'clay'} />
            <ul>
              {profileItems(p, v).map((i) => (
                <li key={i.label} className={i.done ? s.itemDone : ''}>
                  {i.done ? <Check aria-hidden /> : <Circle aria-hidden />} {i.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {edit ? (
            <motion.div key="edit" className={s.formEdit} {...SWAP}>
              <TextField label="Full name" required value={form.name} onChange={(e) => set('name', e.target.value)} error={err.name} autoComplete="name" />
              <TextField label="Mobile number" value={formatPhone(form.phone)} readOnly disabled hint="To change your number, contact support." />
              <TextField label="Email" optional type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={err.email} autoComplete="email" />
              <div>
                <p className={s.groupLabel}>Gender</p>
                <Toggle label="Gender" value={form.gender || 'Female'} onChange={(g) => set('gender', g)} options={[{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }, { value: 'Other', label: 'Other' }]} />
              </div>
              <DateField label="Date of birth" value={form.dob} min="1926-01-01" max={isoDay(new Date())} onChange={(v) => set('dob', v)} error={err.dob} />
              <TextField label="Village" required value={form.village} onChange={(e) => set('village', e.target.value)} error={err.village} />
              <div className={s.grid2}>
                <TextField label="Mandal" required value={form.mandal} onChange={(e) => set('mandal', e.target.value)} error={err.mandal} />
                <TextField label="District" required value={form.district} onChange={(e) => set('district', e.target.value)} error={err.district} />
              </div>
              <div className={s.grid2}>
                <TextField label="State" value={form.state} readOnly disabled />
                <TextField label="Pincode" required inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} error={err.pincode} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="view" className={s.formView} {...SWAP}>
              <Section title="Personal" id="pp">
                <Facts
                  items={[
                    { label: 'Full name', value: p.name },
                    { label: 'Role', value: p.role },
                    { label: 'Partner ID', value: p.partnerId },
                    { label: 'Gender', value: p.gender },
                    { label: 'Date of birth', value: p.dob ? formatDate(`${p.dob}T00:00`, 'medium') : '' },
                    { label: 'Joined', value: formatDate(`${p.joined}T00:00`, 'medium') },
                  ]}
                />
              </Section>
              <Section title="Contact" id="pc">
                <Facts
                  items={[
                    { label: 'Mobile', value: formatPhone(p.phone) },
                    { label: 'Email', value: p.email },
                    { label: 'Languages', value: p.languages.join(', ') },
                  ]}
                />
              </Section>
              <Section title="Work area" id="pa">
                <Facts
                  items={[
                    { label: 'Cluster', value: p.cluster },
                    { label: 'Village', value: p.village },
                    { label: 'Mandal', value: p.mandal },
                    { label: 'District', value: p.district },
                    { label: 'State', value: p.state },
                    { label: 'Pincode', value: p.pincode },
                  ]}
                />
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Screen>
  );
}
