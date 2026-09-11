import { useState } from 'react'
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, commonStyles, spacing, type } from '../theme'
import { PrimaryButton } from '../components/PrimaryButton'

export function LoginScreen({ onLogin, error, loading }: { onLogin: (email: string, password: string) => void; error: string; loading: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const invalid = touched && (!email.includes('@') || password.length === 0)

  return (
    <SafeAreaView style={commonStyles.screen}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
        <Text style={styles.kicker}>METICLECARE</Text>
        <Text style={type.display}>Your working day, in hand.</Text>
        <Text style={styles.intro}>Sign in to see your assigned visits and record care at the point it happens.</Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Work email</Text>
            <TextInput accessibilityLabel="Work email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} onBlur={() => setTouched(true)} placeholder="name@provider.org" placeholderTextColor={colors.mist} style={[commonStyles.field, invalid && styles.invalid]} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput accessibilityLabel="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onBlur={() => setTouched(true)} placeholder="Your password" placeholderTextColor={colors.mist} style={[commonStyles.field, invalid && styles.invalid]} />
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : invalid ? <Text style={styles.helper}>Enter a valid work email and password.</Text> : <Text style={styles.helper}>Use the same account as MeticleCare on the web.</Text>}
          <PrimaryButton label="Sign in" onPress={() => { setTouched(true); if (!invalid && email && password) onLogin(email, password) }} loading={loading} disabled={loading} />
        </View>
        <Text style={styles.footer}>Location is only requested when you record an assigned visit.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  brandMark: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  brandMarkText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  kicker: { ...type.label, color: colors.emeraldDeep, letterSpacing: 1.5, marginBottom: spacing.sm },
  intro: { ...type.body, color: colors.mist, marginTop: spacing.md, maxWidth: 340 },
  form: { marginTop: spacing.xxl, gap: spacing.md },
  fieldGroup: { gap: spacing.xs },
  label: { ...type.label, color: colors.ink },
  invalid: { borderColor: colors.error },
  helper: { ...type.caption, color: colors.mist, minHeight: 20 },
  error: { ...type.caption, color: colors.error, minHeight: 20 },
  footer: { ...type.caption, color: colors.mist, marginTop: spacing.xxl },
})
