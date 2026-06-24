import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { Stack, useFocusEffect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { getOpenTrip, listTrips, startTrip, closeTripAndBackup, Trip } from '@/lib/trips'
import { getDropboxConnection } from '@/lib/dropbox'
import { COLORS, RADIUS } from '@/constants/theme'

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TripsScreen() {
  const { user, currentGroup } = useAuth()
  const [open, setOpen] = useState<Trip | null>(null)
  const [history, setHistory] = useState<Trip[]>([])
  const [dropboxConnected, setDropboxConnected] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!currentGroup) return
    const [openTrip, all, conn] = await Promise.all([
      getOpenTrip(currentGroup.id),
      listTrips(currentGroup.id),
      getDropboxConnection(currentGroup.id),
    ])
    setOpen(openTrip)
    setHistory(all.filter(t => t.ended_at)) // solo cerrados en el historial
    setDropboxConnected(conn?.status === 'connected')
    setLoading(false)
  }, [currentGroup])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function handleStart() {
    if (!newName.trim()) {
      Alert.alert('Ponle un nombre', '¿Cómo se llama el viaje?')
      return
    }
    setBusy(true)
    const res = await startTrip(currentGroup!.id, user!.id, newName)
    setBusy(false)
    if (res.ok) {
      setNewName('')
      load()
    } else {
      Alert.alert('No se pudo empezar', res.error ?? 'Inténtalo de nuevo.')
    }
  }

  function handleClose() {
    if (!open) return
    const msg = dropboxConnected
      ? 'Se cerrará el viaje y se respaldarán sus fotos en Dropbox.'
      : 'Se cerrará el viaje. (Dropbox no está conectado, no se respaldarán fotos.)'
    Alert.alert('Cerrar viaje', msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar y respaldar',
        onPress: async () => {
          setBusy(true)
          const res = await closeTripAndBackup(open, dropboxConnected)
          setBusy(false)
          if (res.ok) {
            Alert.alert(
              'Viaje cerrado ✓',
              dropboxConnected
                ? `${res.uploaded} foto${res.uploaded === 1 ? '' : 's'} respaldada${res.uploaded === 1 ? '' : 's'} en Dropbox.`
                : 'El viaje se ha guardado en el historial.'
            )
            load()
          } else {
            Alert.alert('Error al cerrar', res.error ?? 'Inténtalo de nuevo.')
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Viajes', headerShown: true }} />
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Viajes', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Viaje en curso o iniciar uno */}
        {open ? (
          <View style={styles.openCard}>
            <Text style={styles.openLabel}>🧳 Viaje en curso</Text>
            <Text style={styles.openName}>{open.name}</Text>
            <Text style={styles.openDate}>Desde el {fmt(open.started_at)}</Text>

            {!dropboxConnected && (
              <Text style={styles.warn}>
                Dropbox no está conectado. Conéctalo en tu perfil para respaldar al cerrar.
              </Text>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={handleClose} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.closeButtonText}>Cerrar y respaldar</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>Empezar un viaje</Text>
            <Text style={styles.startDesc}>
              Mientras el viaje esté abierto, las fotos que subáis se agruparán en él.
              Al cerrarlo, podréis respaldarlas en Dropbox.
            </Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Ej. Escapada a Lisboa"
              placeholderTextColor={COLORS.muted}
            />
            <TouchableOpacity style={styles.startButton} onPress={handleStart} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.startButtonText}>Empezar viaje</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Historial */}
        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Viajes pasados</Text>
            {history.map(trip => (
              <View key={trip.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{trip.name}</Text>
                  <Text style={styles.historyDate}>
                    {fmt(trip.started_at)} – {trip.ended_at ? fmt(trip.ended_at) : ''}
                  </Text>
                </View>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyCount}>{trip.photo_count} 📷</Text>
                  {trip.backed_up_at && <Text style={styles.historyBacked}>☁️</Text>}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },

  openCard: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 22, marginBottom: 24,
  },
  openLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  openName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 4 },
  openDate: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  warn: { fontSize: 13, color: '#FFE4C4', marginTop: 14, lineHeight: 18 },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', marginTop: 18,
  },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  startCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 22, marginBottom: 24,
    borderWidth: 1, borderColor: COLORS.border,
  },
  startTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  startDesc: { fontSize: 14, color: COLORS.muted, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  input: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: 15,
    fontSize: 16, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14,
  },
  startButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  historyName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  historyDate: { fontSize: 13, color: COLORS.muted, marginTop: 3 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyCount: { fontSize: 14, color: COLORS.muted, fontWeight: '600' },
  historyBacked: { fontSize: 15 },
})
