import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { initials } from '@/lib/format';
import { SPRING_SOFT } from '@/d3/motion/tokens';
import { Screen, PageTitle } from '../../layout/Screen';
import { Note } from '../../ui/Blocks';
import { useDidi } from '../../store';
import { didiQrText, qrMatrix, qrPath } from '../../lib/qr';
import s from './MyQr.module.css';

/** The Didi's own QR code, to show on her phone. The app does not scan codes. */
export default function MyQr() {
  const profile = useDidi((st) => st.profile);
  const { d, size } = useMemo(() => qrPath(qrMatrix(didiQrText(profile.partnerId))), [profile.partnerId]);
  return (
    <Screen title="My QR code" backTo="/home">
      <PageTitle kicker="Kisani Didi" title="My QR code" />
      <div className={s.page}>
        <motion.div className={s.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
          <div className={s.who}>
            <span className={s.avatar} aria-hidden>
              {profile.photo ? <img src={profile.photo} alt="" /> : initials(profile.name)}
            </span>
            <span className={s.whoText}>
              <strong>{profile.name}</strong>
              <small>
                {profile.role} · {profile.cluster}
              </small>
            </span>
          </div>
          <div className={s.qr}>
            <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code for partner ID ${profile.partnerId}`} shapeRendering="crispEdges">
              <rect width={size} height={size} fill="#fff" />
              <path d={d} fill="#1f1a17" />
            </svg>
          </div>
          <div className={s.id}>
            <small>Partner ID</small>
            <strong className="didi-num">{profile.partnerId}</strong>
          </div>
        </motion.div>
        <Note tone="info" icon={<Info aria-hidden />}>
          Show this code when someone needs your Kisani Didi ID. Turn up your screen brightness if it doesn’t scan.
        </Note>
      </div>
    </Screen>
  );
}
