import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { PrimaryButton } from '../components/PrimaryButton'
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  saveCredentials,
  loadCredentials,
  authenticateWithBiometrics,
  getBiometricTypeLabel,
} from '../services/biometrics'
import { hapticLight, hapticMedium } from '../services/haptics'

interface Props {
  onLogin: (email: string, password: string) => void
  error: string
  loading: boolean
}

export function LoginScreen({ onLogin, error, loading }: Props) {
  const c = useAppColors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const invalid = touched && (!email.includes('@') || password.length === 0)

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabledState] = useState(false)
  const [biometricLabel, setBiometricLabel] = useState('biometrics')

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable()
      setBiometricAvailable(available)
      const enabled = await isBiometricEnabled()
      setBiometricEnabledState(enabled)
      setBiometricLabel(getBiometricTypeLabel())

      // Auto-prompt if biometric is enabled and credentials are saved
      if (available && enabled) {
        const creds = await loadCredentials()
        if (creds) {
          const success = await authenticateWithBiometrics()
          if (success) {
            onLogin(creds.email, creds.password)
          }
        }
      }
    })()
  }, [])

  const handleBiometricToggle = async () => {
    hapticMedium()
    if (biometricEnabled) {
      await setBiometricEnabled(false)
      setBiometricEnabledState(false)
    } else {
      // Save current credentials if available, otherwise prompt after login
      await setBiometricEnabled(true)
      setBiometricEnabledState(true)
      if (email && password) {
        await saveCredentials(email, password)
      }
    }
  }

  const handleLogin = async () => {
    setTouched(true)
    if (!invalid && email && password) {
      // Save credentials for biometric login if enabled
      if (biometricEnabled) {
        await saveCredentials(email, password)
      }
      hapticLight()
      onLogin(email, password)
    }
  }

  const handleBiometricLogin = async () => {
    hapticMedium()
    const success = await authenticateWithBiometrics(`Sign in with ${biometricLabel}`)
    if (success) {
      const creds = await loadCredentials()
      if (creds) {
        onLogin(creds.email, creds.password)
      }
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
        >
          {/* Brand block */}
          <View style={styles.brandArea}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>M</Text>
            </View>
            <Text style={styles.kicker}>METICLECARE</Text>
            <Text style={styles.headline}>Your working day,{'\n'}in hand.</Text>
            <Text style={styles.sub}>
              Sign in to see your assigned calls and record care at the point it happens.
            </Text>
          </View>

          {/* Biometric login button */}
          {biometricAvailable && biometricEnabled && (
            <Pressable onPress={handleBiometricLogin} style={styles.biometricBtn}>
              <View style={styles.biometricIconCircle}>
                <Text style={styles.biometricIconLetter}>{biometricLabel === 'Face ID' ? 'F' : 'P'}</Text>
              </View>
              <Text style={styles.biometricText}>Sign in with {biometricLabel}</Text>
            </Pressable>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Work email</Text>
              <TextInput
                accessibilityLabel="Work email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => { setTouched(true); setFocusedField(null) }}
                placeholder="name@provider.org"
                placeholderTextColor={colors.subtle}
                style={[
                  styles.input,
                  focusedField === 'email' && styles.inputFocused,
                  invalid && styles.inputError,
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  accessibilityLabel="Password"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => { setTouched(true); setFocusedField(null) }}
                  placeholder="Your password"
                  placeholderTextColor={colors.subtle}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    focusedField === 'password' && styles.inputFocused,
                    invalid && styles.inputError,
                  ]}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => { hapticLight(); setShowPassword(!showPassword) }}
                  style={styles.eyeBtn}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>!</Text>
                <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
              </View>
            ) : invalid ? (
              <Text style={styles.helper}>Enter a valid work email and password.</Text>
            ) : (
              <Text style={styles.helper}>Same account as MeticleCare on the web.</Text>
            )}

            <PrimaryButton
              label="Sign in"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
            />

            {/* Biometric toggle */}
            {biometricAvailable && (
              <Pressable onPress={handleBiometricToggle} style={styles.biometricToggle}>
                <View style={[styles.toggle, biometricEnabled && styles.toggleOn]}>
                  <View style={[styles.toggleDot, biometricEnabled && styles.toggleDotOn]} />
                </View>
                <Text style={styles.toggleLabel}>
                  {biometricEnabled ? `${biometricLabel} enabled` : `Enable ${biometricLabel}`}
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.footer}>
            Location is only requested when you record an assigned call.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  brandArea: { marginBottom: spacing.xxl },
  logoMark: {
    width: 48, height: 48, borderRadius: radii.md,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.base, ...elevation.md,
  },
  logoText: { color: colors.inverse, fontSize: 24, fontWeight: '800' },
  kicker: { fontFamily: 'System', fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: colors.primary, marginBottom: spacing.md },
  headline: { fontFamily: 'System', fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.8, color: colors.ink },
  sub: { ...type.body, color: colors.muted, marginTop: spacing.md, maxWidth: 320, lineHeight: 21 },

  /* Biometric big button */
  biometricBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1.5, borderColor: colors.primary + '30', paddingVertical: spacing.base,
    marginBottom: spacing.base, ...elevation.sm,
  },
  biometricIconCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  biometricIconLetter: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: colors.primary },
  biometricText: { fontFamily: 'System', fontSize: 16, fontWeight: '700', color: colors.primary },

  form: { gap: spacing.base },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontFamily: 'System', fontSize: 13, fontWeight: '600', color: colors.inkLight },
  input: {
    minHeight: 52, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surface, paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    color: colors.ink, fontFamily: 'System', fontSize: 16,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  inputError: { borderColor: colors.danger },

  /* Password */
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: spacing.sm, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  eyeIcon: { fontFamily: 'System', fontSize: 11, fontWeight: '600', color: colors.primary },

  helper: { ...type.small, minHeight: 18 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerSurface, padding: spacing.md, borderRadius: radii.md },
  errorIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, color: colors.inverse, textAlign: 'center', lineHeight: 22, fontSize: 13, fontWeight: '700', overflow: 'hidden' },
  errorText: { ...type.small, color: colors.dangerDeep, flex: 1 },

  /* Biometric toggle */
  biometricToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  toggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: colors.primary },
  toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.inverse },
  toggleDotOn: { alignSelf: 'flex-end' },
  toggleLabel: { ...type.small, color: colors.muted },

  footer: { ...type.caption, color: colors.subtle, marginTop: spacing.xxxl, textAlign: 'center' },
})
