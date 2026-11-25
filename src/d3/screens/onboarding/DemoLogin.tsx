import { FlaskConical } from 'lucide-react';
import { actions } from '@/services/store';
import { DEMO_ACCOUNT } from '@/data/people';
import { Button } from '../../ui/Button';
import { Note } from '../../ui/Blocks';
import { useNav } from '../../nav';
import { endFlow } from './flow';

export function formatDemoPhone() {
  return `${DEMO_ACCOUNT.phone.slice(0, 5)} ${DEMO_ACCOUNT.phone.slice(5)}`;
}

/** Signs in as the sample farmer and opens Home. */
export function useDemoLogin() {
  const nav = useNav();
  return () => {
    actions.signInDemo();
    endFlow();
    nav('/home', { replace: true });
  };
}

/** The demo account's details, with a one-tap way in. */
export function DemoNote() {
  const login = useDemoLogin();
  return (
    <Note tone="info" icon={<FlaskConical aria-hidden />} title="Demo account" action={<Button size="sm" variant="secondary" onClick={login}>Log in as demo farmer</Button>}>
      User ID <strong>{DEMO_ACCOUNT.userId}</strong> · password <strong>{DEMO_ACCOUNT.password}</strong>, or mobile <strong>{formatDemoPhone()}</strong> with OTP 123456.
    </Note>
  );
}
