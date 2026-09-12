import { useState } from 'react'
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import { PrimaryButton } from '../components/PrimaryButton'

export function LoginScreen({ onLogin, error, loading }: { onLogin: (email: string, password: string) => void; error: string; loading: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const invalid = touched && (!email.includes('@') || password.length === 0)

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Work email</Text>
            <TextInput
              accessibilityLabel="Work email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
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
            <TextInput
              accessibilityLabel="Password"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => { setTouched(true); setFocusedField(null) }}
              placeholder="Your password"
              placeholderTextColor={colors.subtle}
              style={[
                styles.input,
                focusedField === 'password' && styles.inputFocused,
                invalid && styles.inputError,
              ]}
            />
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
            onPress={() => { setTouched(true); if (!invalid && email && password) onLogin(email, password) }}
            loading={loading}
            disabled={loading}
          />
        </View>

        <Text style={styles.footer}>
          Location is only requested when you record an assigned call.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  brandArea: {
    marginBottom: spacing.xxxl,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    ...elevation.md,
  },
  logoText: {
    color: colors.inverse,
    fontSize: 24,
    fontWeight: '800',
  },
  kicker: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  headline: {
    fontFamily: 'System',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  sub: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing.md,
    maxWidth: 320,
    lineHeight: 21,
  },
  form: {
    gap: spacing.base,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkLight,
  },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontFamily: 'System',
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  helper: {
    ...type.small,
    minHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSurface,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  errorIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    color: colors.inverse,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  errorText: {
    ...type.small,
    color: colors.dangerDeep,
    flex: 1,
  },
  footer: {
    ...type.caption,
    color: colors.subtle,
    marginTop: spacing.xxxl,
    textAlign: 'center',
  },
})
