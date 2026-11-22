import { useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { actions, getState } from '@/services/store';
import { maskPhone } from '@/lib/password';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { Done } from './Done';
import { OtpForm } from './OtpForm';
import { readFlow, updateFlow, endFlow } from './flow';

const BACK: Record<string, string> = { signup: '/auth', login: '/login', 'forgot-password': '/auth/forgot-password', 'forgot-user-id': '/auth/forgot-user-id' };

/** OTP verification for every flow: sign up, log in, forgot password, forgot User ID. */
export default function Otp() {
  const nav = useNav();
  const [flow] = useState(readFlow);
  const [verified, setVerified] = useState(false);

  const next = useCallback(() => {
    const f = readFlow();
    if (!f) return;
    if (f.purpose === 'signup') nav('/auth/user-id', { replace: true });
    else if (f.purpose === 'forgot-password') nav('/auth/reset-password', { replace: true });
    else if (f.purpose === 'forgot-user-id') nav('/auth/enter-password', { replace: true });
    else {
      actions.signIn(f.phone, true);
      endFlow();
      nav(getState().profileDetails.completed < 3 ? '/profile/setup/1' : '/home', { replace: true });
    }
  }, [nav]);

  if (!flow?.phone) return <Navigate to={to('/auth')} replace />;
  if (verified) return <Done icon={<ShieldCheck />} title="Verified successfully" text="Your OTP has been verified." onContinue={next} />;
  return (
    <AuthShell title="OTP verification" text={<>OTP sent to <strong>{maskPhone(flow.phone)}</strong></>} back={BACK[flow.purpose]}>
      <OtpForm
        phone={flow.phone}
        action={flow.purpose === 'login' ? 'Log in' : 'Verify'}
        onVerified={() => {
          updateFlow({ verified: true });
          setVerified(true);
        }}
      />
    </AuthShell>
  );
}
