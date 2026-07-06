import { AppLanguage } from '@/services/i18n';

import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

export function SettingsNotificationsSection({ lang }: Props) {
  const title = lang === 'ua' ? 'Сповіщення' : lang === 'no' ? 'Varsler' : 'Notifications';
  const soon = lang === 'ua' ? 'Скоро' : lang === 'no' ? 'Kommer' : 'Soon';

  return (
    <GlassSettingsSection title={title}>
      <GlassSettingsRow icon="🔔" title="Daily reminder" value={soon} disabled />
      <GlassSettingsRow icon="🔥" title="Learning streak" value={soon} disabled />
      <GlassSettingsRow icon="🏆" title="Achievements" value={soon} disabled isLast />
    </GlassSettingsSection>
  );
}