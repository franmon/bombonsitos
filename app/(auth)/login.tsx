import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { COLORS, FONTS, RADIUS } from '@/constants/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Faltan datos', 'Introduce tu email y contraseña.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) Alert.alert('Error al entrar', error.message)
    // Si no hay error, el NavigationGuard redirige automáticamente
  }

  async function handleMagicLink() {
    if (!email) {
      Alert.alert('Introduce tu email', 'Necesitamos tu email para enviarte el enlace.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setMagicSent(true)
    }
  }

  if (magicSent) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emoji}>📧</Text>
        <Text style={styles.title}>Revisa tu email</Text>
        <Text style={styles.subtitle}>
          Te hemos enviado un enlace mágico a {email}.{'\n'}
          Ábrelo desde tu móvil para entrar.
        </Text>
        <TouchableOpacity onPress={() => setMagicSent(false)}>
          <Text style={styles.link}>Volver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>Entra para ver tu despedida</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={COLORS.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryButtonText}>Entrar</Text>
          }
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleMagicLink}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Entrar con enlace mágico ✨</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Primera vez? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Crear cuenta</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  emoji: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: COLORS.muted, textAlign: 'center', marginTop: 6, marginBottom: 32, lineHeight: 22 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: 12, color: COLORS.muted, fontSize: 14 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: COLORS.muted, fontSize: 15 },
  link: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
})
