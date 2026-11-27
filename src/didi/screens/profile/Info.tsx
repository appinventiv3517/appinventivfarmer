import { useParams } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Photo } from '@/d3/photo/Photo';
import { Screen, PageTitle } from '../../layout/Screen';
import { EmptyState, Note } from '../../ui/Blocks';
import s from './Profile.module.css';

const DOCS: Record<string, { title: string; kicker: string; sections: { h: string; p: string }[] }> = {
  about: {
    title: 'About Kisani Urjaa',
    kicker: 'From waste to wealth',
    sections: [
      { h: 'What we do', p: 'Kisani Urjaa helps farmers clear crop residue without burning it, and returns it to the soil as fermented organic manure (FOM).' },
      { h: 'Kisani Didis', p: 'Kisani Didis are women from farming villages who partner with Kisani Urjaa. They register farmers, record land and crops, run village meetings and are the first person a farmer calls.' },
      { h: 'This app', p: 'The Kisani Didi App is where a Didi sees her tasks, her farmers, her attendance and her payments. The Farmer App is its companion for farmers.' },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    kicker: 'Summary',
    sections: [
      { h: 'What the app stores', p: 'Your profile, attendance times and location at check-in, task updates and the photos or files you upload as proof, and the farmer records you work with.' },
      { h: 'Farmers’ information', p: 'Farmer details are visible to you only for farmers in your cluster. Share them only for Kisani Urjaa work.' },
      { h: 'Camera and location', p: 'The camera is used only for your check-in and check-out selfies, proof photos and ID documents. Location is captured only when you check in or out.' },
    ],
  },
  terms: {
    title: 'Terms & conditions',
    kicker: 'Summary',
    sections: [
      { h: 'Your account', p: 'Your Partner ID is for you only. Don’t share your password or OTP with anyone, including farmers.' },
      { h: 'Tasks and proof', p: 'Proof you upload should be from the work you did. Kisani Urjaa reviews every submission.' },
      { h: 'Payments', p: 'Payments are made and recorded by Kisani Urjaa. The app shows them; it does not set amounts.' },
    ],
  },
};

export default function Info() {
  const { doc = '' } = useParams();
  const c = DOCS[doc];
  if (!c)
    return (
      <Screen title="Page" backTo="/profile">
        <EmptyState animation="search" title="Page not found" />
      </Screen>
    );
  return (
    <Screen title={c.title} backTo="/profile">
      <PageTitle kicker={c.kicker} title={c.title} />
      <div className={s.sub}>
        {doc === 'about' && (
          <>
            <div className={s.brandBox}>
              <Logo height={110} />
            </div>
            <div className={s.gutter}>
              <Photo id="kisani-straw-field" ratio="16/9" className={s.infoPhoto} />
            </div>
          </>
        )}
        <div className={`${s.gutter} ${s.prose}`}>
          {c.sections.map((sec, i) => (
            <div key={sec.h}>
              <h2>
                <span className={s.num}>{String(i + 1).padStart(2, '0')}</span>
                {sec.h}
              </h2>
              <p>{sec.p}</p>
            </div>
          ))}
        </div>
        {doc !== 'about' && (
          <div className={s.gutter}>
            <Note tone="warning">Placeholder summary for the prototype. Kisani Urjaa will provide the final, reviewed text.</Note>
          </div>
        )}
      </div>
    </Screen>
  );
}
