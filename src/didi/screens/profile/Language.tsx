import { useState } from 'react';
import { Info } from 'lucide-react';
import { useToast } from '@/d3/ui/Toast';
import { LANGUAGE_CATALOG } from '@/services/store';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { Note } from '../../ui/Blocks';
import { didi, getDidi } from '../../store';
import { useNav } from '../../nav';
import { LanguageList } from './LanguageList';
import s from './Profile.module.css';

export default function Language() {
  const nav = useNav();
  const toast = useToast();
  const [lang, setLang] = useState(getDidi().session.language);
  const save = () => {
    didi.setLanguage(lang);
    toast({ message: `Language set to ${LANGUAGE_CATALOG.find((l) => l.code === lang)?.english}`, tone: 'success' });
    nav(-1);
  };
  return (
    <Screen title="Change language" backTo="/profile" footer={<Button size="lg" block onClick={save} disabled={lang === getDidi().session.language}>Save</Button>}>
      <PageTitle title="Change language" />
      <LanguageList value={lang} onChange={setLang} />
      <div className={s.gutter} style={{ paddingBottom: 24 }}>
        <Note tone="info" icon={<Info aria-hidden />}>
          The Kisani Didi App is in English in this prototype. Your choice is saved, and screens will switch once translations are reviewed by native speakers.
        </Note>
      </div>
    </Screen>
  );
}
