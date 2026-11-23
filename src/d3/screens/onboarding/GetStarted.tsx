import { Link } from 'react-router-dom';
import { Languages, LogIn, UserPlus } from 'lucide-react';
import { useStore, LANGUAGE_NAMES } from '@/services/store';
import { Button } from '../../ui/Button';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import s from './Onboarding.module.css';

/** After the intro screens and the language: sign up, or log in to an existing account. */
export default function GetStarted() {
  const language = useStore((st) => st.prefs.language);
  return (
    <AuthShell title="Welcome to Kisani Urjaa" text="Are you new here, or do you already have an account?" back="/welcome/language">
      <div className="fj3-stack" style={{ ['--gap' as string]: '12px' }}>
        <Button size="lg" block icon={<UserPlus aria-hidden />} to="/auth">
          Sign up
        </Button>
        <p className={s.choiceHint}>New to Kisani Urjaa? Create an account with your mobile number.</p>
        <Button size="lg" block variant="secondary" icon={<LogIn aria-hidden />} to="/login">
          Log in
        </Button>
        <p className={s.choiceHint}>Already registered? Log in with an OTP or your User ID.</p>
      </div>
      <p className={s.switchLine}>
        <Languages aria-hidden className={s.inlineIcon} /> {LANGUAGE_NAMES[language]} ·<Link to={to('/welcome/language')}>Change language</Link>
      </p>
    </AuthShell>
  );
}
