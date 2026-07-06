import { AppLanguage } from '@/services/i18n';

import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

export function SettingsAboutSection({ lang }: Props) {
  const title = lang === 'ua' ? 'Про застосунок' : lang === 'no' ? 'Om appen' : 'About';

  return (
    <GlassSettingsSection title={title}>
      <GlassSettingsRow icon="📱" title="Version" value="V10" />
      <GlassSettingsRow icon="🗄️" title="Database" value="Supabase" />
      <GlassSettingsRow icon="📚" title="Dictionary" value="v2.7.3" />
      <GlassSettingsRow icon="🔐" title="Privacy" value="Local + Cloud" isLast />
    </GlassSettingsSection>
  );
}