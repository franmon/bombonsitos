import {
  View, Text, TouchableOpacity, StyleSheet, Share, FlatList,
} from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import * as Contacts from 'expo-contacts'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { COLORS, RADIUS } from '@/constants/theme'

// Invitar amigos — comparte el código y sugiere contactos. Paso 5 del alta.
export default function InviteScreen() {
  const router = useRouter()
  const { user, currentGroup, refreshProfile } = useAuth()
  const [suggested, setSuggested] = useState<{ id: string; name: string }[]>([])
  const [invited, setInvited] = useState<Record<string, boolean>>({})

  const code = currentGroup?.code ?? '------'

  // Carga unos contactos como sugerencia (si hay permiso concedido)
  useEffect(() => {
    (async () => {
      const { status } = await Contacts.getPermissionsAsync()
      if (status !== 'granted') return
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name] })
      setSuggested(
        data.filter(c => c.name).slice(0, 6).map(c => ({ id: c.id!, name: c.name! }))
      )
    })()
  }, [])

  async function share() {
    await Share.share({
      message:
        `¡Únete a la despedida de Jordan! 🎉\n` +
        `Usa el código: ${code}\n` +
        `Descarga DespedidaJordan para entrar.`,
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
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Invita a la cuadrilla</Text>
        <Text style={styles.subtitle}>
          Estás organizando <Text style={styles.bold}>la despedida de Jordan</Text>. ¡Que no falte nadie!
        </Text>

        <View style={styles.codeCard}>
          <View>
            <Text style={styles.codeLabel}>Código del viaje</Text>
            <Text style={styles.codeValue}>{code}</Text>
          </View>
          <TouchableOpacity style={styles.codeShare} onPress={share}>
            <Text style={styles.codeShareText}>Compartir</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.outline} onPress={share}>
          <Text style={styles.outlineText}>🔗  Copiar enlace de invitación</Text>
        </TouchableOpacity>

        {suggested.length > 0 && (
          <>
            <Text style={styles.sectionHead}>Sugerencias de tus contactos</Text>
            <FlatList
              data={suggested}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <View style={styles.contactRow}>
                  <Avatar name={item.name} size={42} />
                  <Text style={styles.contactName}>{item.name}</Text>
                  <TouchableOpacity
                    style={[styles.inviteBtn, invited[item.id] && styles.inviteBtnDone]}
                    onPress={() => { share(); setInvited(p => ({ ...p, [item.id]: true })) }}
                  >
                    <Text style={[styles.inviteBtnText, invited[item.id] && styles.inviteBtnTextDone]}>
                      {invited[item.id] ? '✓ Invitado' : 'Invitar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.primaryButton} onPress={finish}>
          <Text style={styles.primaryButtonText}>Entrar al viaje</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, padding: 28, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginTop: 6, marginBottom: 20, lineHeight: 22 },
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
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 15, alignItems: 'center', marginBottom: 18,
  },
  outlineText: { color: COLORS.text, fontWeight: '700', fontSize: 14.5 },
  sectionHead: { fontSize: 12.5, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  contactName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  inviteBtn: { borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8 },
  inviteBtnDone: { borderColor: COLORS.primary },
  inviteBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: 13.5 },
  inviteBtnTextDone: { color: COLORS.primary },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
