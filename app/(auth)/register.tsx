import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'

// Crear cuenta — reskin azul + naranja con:
//  · mostrar/ocultar contraseña
//  · validación en línea (sin Alerts para los campos)
//  · al registrarse, continúa al onboarding (perfil)
export default function RegisterScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  function validate() {
    const e: typeof errors = {}
    if (!name.trim()) e.name = 'Dinos cómo te llamas.'
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) e.email = 'Email no válido.'
    if (password.length < 8) e.password = 'Mínimo 8 caracteres.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleRegister() {
    if (!validate()) return

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error al registrarse', error.message)
      return
    }

    // Continúa el alta. (Si tienes confirmación por email activada en Supabase,
    // cambia esto por una pantalla "revisa tu correo".)
    router.replace('/onboarding/profile')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoMark}><Text style={styles.logoMarkText}>✈️</Text></View>
          <Text style={styles.logoWord}>Despedida<Text style={styles.logoWordAccent}>Jordan</Text></Text>
        </View>

        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Un momento y empezáis a planear juntos.</Text>

        <Text style={styles.label}>Tu nombre</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="Cómo te conocen tus amigos"
          placeholderTextColor={COLORS.muted}
          value={name}
          onChangeText={setName}
        />
        {errors.name && <Text style={styles.error}>{errors.name}</Text>}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="tu@email.com"
          placeholderTextColor={COLORS.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {errors.email && <Text style={styles.error}>{errors.email}</Text>}

        <Text style={styles.label}>Contraseña</Text>
        <View style={[styles.input, styles.inputRow, errors.password && styles.inputError]}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={COLORS.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(s => !s)} hitSlop={10}>
            <Text style={styles.eye}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.error}>{errors.password}</Text>}

        <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryButtonText}>Crear cuenta</Text>}
        </TouchableOpacity>

        <Text style={styles.fine}>
          Al continuar aceptas las Condiciones y la Política de privacidad.
        </Text>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Ya tengo cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 28, paddingTop: 64 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  logoMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { fontSize: 18 },
  logoWord: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  logoWordAccent: { color: COLORS.accent, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginBottom: 26 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 7 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 15, fontSize: 15,
    color: COLORS.text, marginBottom: 6, borderWidth: 1.5, borderColor: COLORS.border,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  inputFlex: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  inputError: { borderColor: COLORS.danger, backgroundColor: '#fff' },
  eye: { fontSize: 18 },
  error: { color: COLORS.danger, fontSize: 12, fontWeight: '600', marginBottom: 12 },
  primaryButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 18,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fine: { fontSize: 11.5, color: COLORS.muted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  backButton: { alignItems: 'center', marginTop: 18, padding: 8 },
  backText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
})
