import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { colors, typography } from '../../theme';
import BrandLogo from '../../components/BrandLogo';

// Defined outside the screen component to prevent re-mounting on every keystroke
const Field = ({ label, placeholder, value, onChange, keyboardType = 'default', secure, rightIcon, onRightIcon, autoCapitalize = 'words', returnKeyType = 'next' }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      <TextInput
        style={[styles.input, rightIcon && { paddingRight: 48 }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secure}
        returnKeyType={returnKeyType}
      />
      {rightIcon && (
        <TouchableOpacity style={styles.eyeBtn} onPress={onRightIcon}>
          <Ionicons name={rightIcon} size={20} color={colors.textLight} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuthStore();

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.email.includes('@')) return 'Valid email is required.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(form.password)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(form.password)) return 'Password must contain a number.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) { Alert.alert('Validation Error', error); return; }

    setIsLoading(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, phone: form.phone || undefined });
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0F6A51', colors.primary, '#35B38C']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            {/* Back */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.logoShell}>
                <BrandLogo width={196} />
              </View>
              <Text style={styles.tagline}>Join smart shoppers who compare first and spend with confidence.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create Account</Text>
              <Text style={styles.cardSubtitle}>Start saving money today</Text>

              <Field label="Full Name" placeholder="John Doe" value={form.name} onChange={set('name')} />
              <Field label="Email Address" placeholder="you@example.com" value={form.email} onChange={set('email')} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Phone (optional)" placeholder="+1 234 567 8900" value={form.phone} onChange={set('phone')} keyboardType="phone-pad" autoCapitalize="none" />
              <Field
                label="Password"
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                value={form.password}
                onChange={set('password')}
                autoCapitalize="none"
                secure={!showPassword}
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIcon={() => setShowPassword(!showPassword)}
              />
              <Field
                label="Confirm Password"
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                autoCapitalize="none"
                secure={true}
                returnKeyType="done"
              />

              {/* Password strength hints */}
              <View style={styles.hints}>
                {[
                  { ok: form.password.length >= 8, text: 'At least 8 characters' },
                  { ok: /[A-Z]/.test(form.password), text: 'One uppercase letter' },
                  { ok: /[0-9]/.test(form.password), text: 'One number' },
                ].map((h, i) => (
                  <View key={i} style={styles.hintRow}>
                    <Ionicons name={h.ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={h.ok ? colors.success : colors.textLight} />
                    <Text style={[styles.hintText, h.ok && { color: colors.success }]}>{h.text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.registerBtn, isLoading && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={20} color="#fff" />
                    <Text style={styles.registerBtnText}>Create Account</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  backBtn: { marginTop: 8, marginBottom: 8, width: 40, height: 40, justifyContent: 'center' },
  header: { alignItems: 'center', paddingVertical: 16 },
  logoShell: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.84)', marginTop: 4, textAlign: 'center', maxWidth: 300, lineHeight: 21 },
  card: {
    backgroundColor: '#fff', borderRadius: 28, padding: 24, marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, letterSpacing: 0.4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.background,
  },
  input: { flex: 1, paddingVertical: 13, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  eyeBtn: { padding: 12 },
  hints: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintText: { fontSize: 11, color: colors.textLight },
  registerBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  registerBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginLink: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
