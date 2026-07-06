import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { AppLanguage } from '@/services/i18n';
import { useAppTheme } from '@/services/theme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

export function SettingsProfileSection({ lang }: Props) {
  const { user, signOut } = useAuthStore();
  const { display_name, updateSetting, saveSettings } = useSettingsStore();
  const { colors, scale } = useAppTheme();

  const [signingOut, setSigningOut] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [draftName, setDraftName] = useState('');

  const sectionTitle = lang === 'ua' ? 'Профіль' : lang === 'no' ? 'Profil' : 'Profile';
  const nameTitle = lang === 'ua' ? 'Ім’я' : lang === 'no' ? 'Navn' : 'Name';
  const emailTitle = lang === 'ua' ? 'Email' : lang === 'no' ? 'E-post' : 'Email';
  const signOutTitle = lang === 'ua' ? 'Вийти' : lang === 'no' ? 'Logg ut' : 'Sign out';
  const notSet = lang === 'ua' ? 'Не задано' : lang === 'no' ? 'Ikke satt' : 'Not set';
  const doneTitle = lang === 'ua' ? 'Готово' : lang === 'no' ? 'Ferdig' : 'Done';

  function openNameModal() {
    setDraftName(display_name || '');
    setNameModalVisible(true);
  }

  async function saveName() {
  updateSetting('display_name', draftName.trim());

  setTimeout(() => {
    void saveSettings();
  }, 0);

  setNameModalVisible(false);
}

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <GlassSettingsSection title={sectionTitle}>
        <GlassSettingsRow
          icon="👤"
          title={nameTitle}
          value={display_name || notSet}
          onPress={openNameModal}
        />

        <GlassSettingsRow
          icon="✉️"
          title={emailTitle}
          value={user?.email || notSet}
        />

        <GlassSettingsRow
          icon="🚪"
          title={signingOut ? '...' : signOutTitle}
          value=""
          isLast
          onPress={handleSignOut}
        />
      </GlassSettingsSection>

      <Modal
        animationType="fade"
        transparent
        visible={nameModalVisible}
        onRequestClose={() => setNameModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setNameModalVisible(false)}>
          <GlassSurface variant="sheet" style={styles.modalWrap} contentStyle={styles.modalContent}>
            <SafeAreaView edges={['bottom']}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: scale(18) }]}>
                {nameTitle}
              </Text>

              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder={nameTitle}
                placeholderTextColor={colors.textTertiary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveName}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: 'rgba(255,255,255,0.22)',
                    fontSize: scale(16),
                  },
                ]}
              />

              <Pressable style={[styles.doneButton, { backgroundColor: colors.accent }]} onPress={saveName}>
                <Text style={[styles.doneText, { fontSize: scale(15) }]}>
                  {doneTitle}
                </Text>
              </Pressable>
            </SafeAreaView>
          </GlassSurface>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  modalWrap: {
    width: '100%',
  },
  modalContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  modalTitle: {
    textAlign: 'center',
    fontWeight: '900',
    marginBottom: 16,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  doneButton: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});