import { Text, View } from 'react-native';

import { Lexeme360 } from '@/components/Lexeme360';
import { VerificationBadge } from '@/components/VerificationBadge';
import { HomonymsButton } from '@/components/HomonymsButton';
import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { AppLanguage } from '@/services/i18n';


type Props = {
  current: any;
  isDark: boolean;
  s: any;
  appLanguage: AppLanguage;
  taskTitle: string;
  getCategoryLabel: (cat: string) => string;
  getMainWord: (w: any) => string;
  hasVerification: (w: any) => boolean;
  hasRelations: (w: any) => boolean;
};

export function TrainingMeta({
  current,
  isDark,
  s,
  appLanguage,
  taskTitle,
  getCategoryLabel,
  getMainWord,
  hasVerification,
  hasRelations,
}: Props) {
  return (
    <View style={s.metaRow}>
      <View style={s.metaLeft}>
        <GlassSurface
          variant="badge"
          dark={isDark}
          style={s.tagGlass}
          contentStyle={s.tagInner}
        >
          <Text style={s.tagText}>
            {getCategoryLabel(current.category || current.type || '')}
          </Text>
        </GlassSurface>

        <GlassSurface
          variant="badge"
          dark={isDark}
          style={s.tagGlass}
          contentStyle={s.tagInner}
        >
          <Text style={s.tagTextMuted}>{taskTitle}</Text>
        </GlassSurface>
      </View>

      <View style={s.tools}>
        {hasVerification(current) ? (
          <VerificationBadge
            tier={current.verification_tier}
            sourceVerified={current.source_verified}
            evidence={current.verification_evidence}
            lemma={current.lemma || current.word}
            size="sm"
            lang={appLanguage as any}
            entityId={current.id}
          />
        ) : null}

        {/* D10 stage E (R5): other cards with the same lemma; hidden when none */}
        <HomonymsButton
          lexemeId={current.id}
          lemma={current.lemma || current.word}
          lang={appLanguage as any}
        />

        {hasRelations(current) ? (
          <Lexeme360
            lexemeId={current.id}
            lemma={getMainWord(current)}
            pos={current.pos || current.category || current.type}
            lang={appLanguage as any}
          />
        ) : null}
      </View>
    </View>
  );
}
