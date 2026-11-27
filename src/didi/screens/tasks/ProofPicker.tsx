import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, FileText, Paperclip, Video, X } from 'lucide-react';
import { useToast } from '@/d3/ui/Toast';
import { Photo } from '@/d3/photo/Photo';
import { SPRING_SOFT } from '@/d3/motion/tokens';
import type { Proof } from '../../data/tasks';
import s from './Tasks.module.css';

const MAX = 10 * 1024 * 1024;

function kb(n?: number) {
  if (!n) return '';
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

/** One proof, as a tile. */
export function ProofTile({ proof, onRemove }: { proof: Proof; onRemove?: () => void }) {
  return (
    <div className={s.proof}>
      {proof.kind === 'photo' && proof.url ? <img src={proof.url} alt={proof.name} /> : proof.kind === 'photo' && proof.slot ? <Photo id={proof.slot} ratio="fill" alt={proof.name} /> : (
        <span className={s.proofDoc}>
          {proof.kind === 'video' ? <Video aria-hidden /> : <FileText aria-hidden />}
          <small>{proof.name}</small>
          <small>{kb(proof.size)}</small>
        </span>
      )}
      {onRemove && (
        <button type="button" className={s.proofRemove} onClick={onRemove} aria-label={`Remove ${proof.name}`}>
          <X aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Add proof by photo (camera on phones), video or file. Files stay on this device. */
export function ProofPicker({ value, onChange }: { value: Proof[]; onChange: (p: Proof[]) => void }) {
  const toast = useToast();
  const refs = { photo: useRef<HTMLInputElement>(null), video: useRef<HTMLInputElement>(null), file: useRef<HTMLInputElement>(null) };
  const add = async (kind: Proof['kind'], files: FileList | null) => {
    if (!files?.length) return;
    const next: Proof[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX) {
        toast({ message: `${f.name} is over 10 MB. Choose a smaller file.`, tone: 'error' });
        continue;
      }
      const url = kind === 'photo' ? await shrink(f) : undefined;
      next.push({ id: Math.random().toString(36).slice(2, 9), kind, name: f.name, size: f.size, url });
    }
    if (next.length) {
      onChange([...value, ...next]);
      toast({ message: `${next.length} ${next.length === 1 ? 'file' : 'files'} added`, tone: 'success' });
    }
  };
  const btn = (kind: Proof['kind'], label: string, Icon: typeof Camera, accept: string, capture?: boolean) => (
    <>
      <button type="button" className={s.addProof} onClick={() => refs[kind].current?.click()}>
        <Icon aria-hidden />
        {label}
      </button>
      <input ref={refs[kind]} type="file" hidden accept={accept} multiple {...(capture ? { capture: 'environment' } : {})} onChange={(e) => (add(kind, e.target.files), (e.target.value = ''))} />
    </>
  );
  return (
    <div className={s.proofs}>
      <div className={s.addRow}>
        {btn('photo', 'Photo', Camera, 'image/*', true)}
        {btn('video', 'Video', Video, 'video/*')}
        {btn('file', 'File', Paperclip, '.pdf,.doc,.docx,.xls,.xlsx,.csv,image/*')}
      </div>
      {value.length > 0 && (
        <ul className={s.proofGrid}>
          <AnimatePresence initial={false}>
            {value.map((p) => (
              <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={SPRING_SOFT}>
                <ProofTile proof={p} onRemove={() => onChange(value.filter((x) => x.id !== p.id))} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/** Photos are scaled down to 640 px so they fit in this device's storage. */
function shrink(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}
