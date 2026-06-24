import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import * as Contacts from 'expo-contacts'
import { requestNotificationPermissions } from '@/lib/notifications'
import { COLORS, RADIUS } from '@/constants/theme'

// Permisos — notificaciones + contactos. Paso 4 del alta.
export default function PermissionsScreen() {
  const router = useRouter()
  const [notif, setNotif] = useState(false)
  const [contacts, setContacts] = useState(false)
  const [loading, setLoading] = useState(false)

  async function toggleNotif() {
    if (notif) { setNotif(false); return }
    const granted = await requestNotificationPermissions()
    setNotif(granted)
  }

  async function toggleContacts() {
    if (contacts) { setContacts(false); return }
    const { status } = await Contacts.requestPermissionsAsync()
    setContacts(status === 'granted')
  }

  async function handleContinue() {
    setLoading(true)
    // Pide los permisos que aún no estén activados antes de seguir
    if (!notif) await requestNotificationPermissions()
    if (!contacts) await Contacts.requestPermissionsAsync()
    setLoading(false)
    router.push('/onboarding/invite')
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Activa lo básico</Text>
        <Text style={styles.subtitle}>
          Para que no te pierdas nada del plan. Puedes cambiarlo cuando quieras.
        </Text>

        <View style={styles.list}>
          <PermissionRow
            tone={COLORS.primary} toneBg={COLORS.primaryLight} icon="🔔"
            title="Notificaciones" desc="Avisos de nuevos planes, gastos y mensajes del grupo."
            on={notif} onToggle={toggleNotif}
          />
          <PermissionRow
            tone={COLORS.accent} toneBg={COLORS.accentLight} icon="👥"
            title="Contactos" desc="Encuentra y añade a tus amigos al viaje más rápido."
            on={contacts} onToggle={toggleContacts}
          />
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Activar y continuar</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.skip} onPress={() => router.push('/onboarding/invite')}>
          <Text style={styles.skipText}>Ahora no</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function PermissionRow({ tone, toneBg, icon, title, desc, on, onToggle }: {
  tone: string; toneBg: string; icon: string; title: string; desc: string;
  on: boolean; onToggle: () => void
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.8}>
      <View style={[styles.rowIcon, { backgroundColor: toneBg }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <View style={[styles.switch, on && { backgroundColor: COLORS.primary }]}>
        <View style={[styles.knob, on && { left: 21 }]} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, padding: 28, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginTop: 6, marginBottom: 24, lineHeight: 22 },
  list: { gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
  },
  rowIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  rowDesc: { fontSize: 12.5, color: COLORS.muted, marginTop: 2, lineHeight: 17 },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: COLORS.border, justifyContent: 'center' },
  knob: {
    position: 'absolute', left: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
  },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { alignItems: 'center', marginTop: 16, padding: 6 },
  skipText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
})
