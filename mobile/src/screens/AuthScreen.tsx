import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Mode = 'signin' | 'signup' | 'verify';

export default function AuthScreen() {
  const { signIn, signUp, verifyEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const otpInputRef = useRef<TextInput>(null);

  async function handleSubmit() {
    if (!email || !password) { setError('Email and password are required.'); return; }
    setError('');
    setLoading(true);

    if (mode === 'signin') {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      const { error: err, requiresVerification } = await signUp(email, password);
      if (err) {
        setError(err);
      } else if (requiresVerification) {
        setPendingEmail(email);
        setOtp('');
        setMode('verify');
        setTimeout(() => otpInputRef.current?.focus(), 100);
      }
    }

    setLoading(false);
  }

  async function handleVerify() {
    if (otp.length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    setError('');
    setLoading(true);
    const err = await verifyEmail(pendingEmail, otp);
    if (err) setError(err);
    setLoading(false);
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    const err = await signInWithGoogle();
    if (err) setError(err);
    setGoogleLoading(false);
  }

  function switchMode(next: 'signin' | 'signup') {
    setMode(next);
    setError('');
    setOtp('');
  }

  // ── Verify screen ────────────────────────────────────────────────────────────
  if (mode === 'verify') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
          <Text style={styles.logo}>DealFlow</Text>
          <Text style={styles.tagline}>Your AI trading agent for shopping</Text>

          <View style={styles.card}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{pendingEmail}</Text>
            </Text>

            <Text style={styles.label}>Verification code</Text>
            <TextInput
              ref={otpInputRef}
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, (loading || otp.length !== 6) && { opacity: 0.6 }]}
              onPress={handleVerify}
              disabled={loading || otp.length !== 6}
            >
              {loading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.btnText}>Verify & Continue</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => switchMode('signup')}>
              <Text style={styles.toggle}>Back to sign up</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Sign in / Sign up ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.logo}>DealFlow</Text>
        <Text style={styles.tagline}>Your AI trading agent for shopping</Text>

        <View style={styles.card}>
          <Text style={styles.title}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={v => setEmail(v.trim())}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
            }
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, googleLoading && { opacity: 0.6 }]}
            onPress={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={styles.toggle}>
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 4 },
  tagline: { color: colors.mutedForeground, textAlign: 'center', marginBottom: 40, fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  subtitle: { color: colors.mutedForeground, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  emailHighlight: { color: colors.foreground, fontWeight: '600' },
  label: { color: colors.mutedForeground, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.background, borderRadius: 10, padding: 14,
    color: colors.foreground, fontSize: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  otpInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  error: { color: colors.primary, fontSize: 13, marginBottom: 12 },
  btn: { backgroundColor: colors.dealGreen, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  toggle: { color: colors.mutedForeground, textAlign: 'center', fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.mutedForeground, fontSize: 12 },
  googleBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 14, alignItems: 'center', marginBottom: 16,
    backgroundColor: colors.card,
  },
  googleBtnText: { color: colors.foreground, fontWeight: '600', fontSize: 15 },
});
