import { AppLanguage } from '@/services/i18n';

import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

export function SettingsAISection({ lang }: Props) {
  const title = lang === 'ua' ? 'AI' : lang === 'no' ? 'AI' : 'AI';
  const soon = lang === 'ua' ? 'Скоро' : lang === 'no' ? 'Kommer' : 'Soon';

  return (
    <GlassSettingsSection title={title}>
      <GlassSettingsRow icon="🤖" title="AI Reading" value={soon} disabled />
      <GlassSettingsRow icon="💬" title="AI Explanation" value={soon} disabled />
      <GlassSettingsRow icon="🎙️" title="AI Voice" value={soon} disabled isLast />
    </GlassSettingsSection>
  );
}