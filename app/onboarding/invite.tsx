import {
  View, Text, TouchableOpacity, StyleSheet, Share,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'

// Invitar a la pareja — comparte el código. Último paso del alta.
export default function InviteScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user, currentGroup, refreshProfile } = useAuth()

  const code = currentGroup?.code ?? '------'
  const spaceName = currentGroup?.name ?? 'nuestro espacio'

  async function share() {
    await Share.share({
      message:
        `¡Únete a "${spaceName}"! 💑\n` +
        `Usa el código: ${code}`,
    })
  }

  async function finish() {
    // Marca el alta como terminada para que el guard te lleve a la app
    if (user) {
      await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id)
      await refreshProfile()
    }
    router.replace('/(tabs)')
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.inner}>
        <Text style={styles.title}>Invita a tu pareja</Text>
        <Text style={styles.subtitle}>
          Comparte este código para que se una a <Text style={styles.bold}>{spaceName}</Text> y empecéis a compartir cosas juntos.
        </Text>

        <View style={styles.codeCard}>
          <View>
            <Text style={styles.codeLabel}>Vuestro código</Text>
            <Text style={styles.codeValue}>{code}</Text>
          </View>
          <TouchableOpacity style={styles.codeShare} onPress={share}>
            <Text style={styles.codeShareText}>Compartir</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.outline} onPress={share}>
          <Text style={styles.outlineText}>🔗  Compartir el código</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          También puedes compartirlo más tarde desde la pestaña "Nosotros".
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={finish}>
        <Text style={styles.primaryButtonText}>Entrar</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 28 },
  inner: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginTop: 6, marginBottom: 24, lineHeight: 22 },
  bold: { color: COLORS.text, fontWeight: '700' },
  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 20, marginBottom: 12,
  },
  codeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 3 },
  codeValue: { fontSize: 26, fontWeight: '800', letterSpacing: 6, color: '#fff' },
  codeShare: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9 },
  codeShareText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  outline: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 15, alignItems: 'center', marginBottom: 16,
  },
  outlineText: { color: COLORS.text, fontWeight: '700', fontSize: 14.5 },
  hint: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 19 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
