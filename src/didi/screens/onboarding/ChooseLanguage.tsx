import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { didi, getDidi } from '../../store';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { useNav } from '../../nav';
import { LanguageList } from '../profile/LanguageList';

/** After the intro: pick the app language, then log in. */
export default function ChooseLanguage() {
  const nav = useNav();
  const [lang, setLang] = useState(getDidi().session.language);
  return (
    <Screen
      title="Choose your language"
      backTo="/welcome"
      footer={
        <Button size="lg" block iconRight={<ArrowRight aria-hidden />} onClick={() => (didi.finishOnboarding(lang), nav('/login'))}>
          Continue
        </Button>
      }
    >
      <PageTitle title="Choose your language" deck="You can change it later in Profile." />
      <LanguageList value={lang} onChange={setLang} />
    </Screen>
  );
}
