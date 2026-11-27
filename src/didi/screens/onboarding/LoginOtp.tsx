import { Navigate } from 'react-router-dom';
import { maskPhone } from '@/lib/password';
import { OtpForm } from '@/d3/screens/onboarding/OtpForm';
import s from '@/d3/screens/onboarding/Onboarding.module.css';
import { didi } from '../../store';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { getLoginPhone } from './flow';

export default function LoginOtp() {
  const nav = useNav();
  const flow = getLoginPhone();
  if (!flow) return <Navigate to={to('/login')} replace />;
  const reset = flow.purpose === 'reset';
  return (
    <AuthShell title="Enter the OTP" back={reset ? '/login/forgot' : '/login?with=otp'}>
      <p className={s.otpLead}>
        Sent to <strong>{maskPhone(flow.phone)}</strong>
      </p>
      <OtpForm
        phone={flow.phone}
        action={reset ? 'Verify' : 'Log in'}
        onVerified={() => {
          if (reset) nav('/login/forgot?step=new', { replace: true });
          else {
            didi.signIn();
            nav('/home', { replace: true });
          }
        }}
      />
    </AuthShell>
  );
}
