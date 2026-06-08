import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuthStore } from '@/store/authStore';

type Step = 'enter_email' | 'enter_code';

export default function LoginScreen() {
  const { signInWithOtp, verifyOtp, loading } = useAuthStore();

  const [email, setEmail]   = useState('');
  const [code, setCode]     = useState('');
  const [step, setStep]     = useState<Step>('enter_email');
  const [error, setError]   = useState('');

  const codeRef = useRef<TextInput>(null);

  async function handleSendCode() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Введи правильний email.');
      return;
    }
    setError('');
    const { error: authError } = await signInWithOtp(trimmed);
    if (authError) {
      setError(authError);
      return;
    }
    setStep('enter_code');
    setTimeout(() => codeRef.current?.focus(), 300);
  }

  async function handleVerifyCode() {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setError('Введи код з листа.');
      return;
    }
    setError('');
    const { error: authError } = await verifyOtp(email, trimmed);
    if (authError) {
      setError('Невірний або застарілий код. Спробуй ще раз.');
      return;
    }
    // onAuthStateChange в authStore автоматично оновить session → redirect спрацює
  }

  async function handleResend() {
    setCode('');
    setError('');
    const { error: authError } = await signInWithOtp(email);
    if (authError) {
      setError(authError);
    }
  }

  if (step === 'enter_code') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.emoji}>📬</Text>
          <Text style={styles.title}>Перевір пошту</Text>
          <Text style={styles.subtitle}>
            Ми надіслали 6-значний код на{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>

          <TextInput
            ref={codeRef}
            style={styles.codeInput}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 8))}
            placeholder="00000000"
            keyboardType="number-pad"
            maxLength={8}
            textAlign="center"
            onSubmitEditing={handleVerifyCode}
            returnKeyType="done"
          />

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <Pressable
            style={[styles.button, (loading || code.length < 6) && styles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={loading || code.length < 6}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Перевірка...' : '✅ Увійти'}
            </Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={handleResend} disabled={loading}>
            <Text style={styles.linkButtonText}>
              Не отримав? Надіслати ще раз
            </Text>
          </Pressable>

          <Pressable
            style={styles.linkButton}
            onPress={() => { setStep('enter_email'); setCode(''); setError(''); }}
          >
            <Text style={styles.linkButtonText}>← Змінити email</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.emoji}>🇳🇴</Text>
        <Text style={styles.title}>Norsk Trainer</Text>
        <Text style={styles.subtitle}>
          Введи email щоб увійти або зареєструватись
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={handleSendCode}
          returnKeyType="send"
        />

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <Pressable
          style={[styles.button, (loading || !email.trim()) && styles.buttonDisabled]}
          onPress={handleSendCode}
          disabled={loading || !email.trim()}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Надсилання...' : '✉️ Отримати код'}
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          Без пароля — просто введи код з листа
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emailText: {
    fontWeight: '700',
    color: '#0D9488',
  },
  input: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  codeInput: {
    width: '100%',
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#0D9488',
    borderRadius: 16,
    padding: 16,
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: 8,
  },
  error: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  linkButtonText: {
    color: '#0D9488',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
});