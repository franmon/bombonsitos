import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS } from '@/constants/theme'

// Bienvenida — primera pantalla del alta.
// Héroe azul con la marca + accesos a Crear cuenta / Entrar.
export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>💑</Text>
          </View>
          <Text style={styles.logoWord}>
            Bombon<Text style={styles.logoWordAccent}>sitos</Text>
          </Text>
        </View>

        <Text style={styles.title}>Vuestro espacio{'\n'}en común</Text>
        <Text style={styles.subtitle}>
          Planes, gastos y fotos de los dos, en un solo sitio.
        </Text>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.primaryButtonText}>Empezar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.linkText}>¿Ya tienes cuenta? </Text>
          <Text style={styles.linkStrong}>Entrar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  hero: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  logoMark: {
    width: 50, height: 50, borderRadius: RADIUS.lg, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  logoMarkText: { fontSize: 24 },
  logoWord: { fontSize: 22, fontWeight: '700', color: '#fff' },
  logoWordAccent: { color: COLORS.accent, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', lineHeight: 36, letterSpacing: -0.6 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 24, maxWidth: 320 },
  footer: { backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 12, gap: 12 },
  primaryButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 17, alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', padding: 6 },
  linkText: { color: COLORS.muted, fontSize: 15 },
  linkStrong: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
})
