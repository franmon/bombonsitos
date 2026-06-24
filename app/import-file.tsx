import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Switch,
} from 'react-native'
import { useState } from 'react'
import { useRouter, Stack } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'

interface ImportActivity {
  title: string
  date: string | null
  time: string | null
  location: string | null
  description: string | null
  _include: boolean
}
interface ImportHotel {
  name: string
  address: string | null
  checkin: string | null
  checkout: string | null
  wifi: string | null
  safe_code: string | null
  _include: boolean
}
interface ImportFlight {
  flight_number: string | null
  from: string | null
  to: string | null
  departure: string | null
  _include: boolean
}

export default function ImportFileScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activities, setActivities] = useState<ImportActivity[]>([])
  const [hotels, setHotels] = useState<ImportHotel[]>([])
  const [flights, setFlights] = useState<ImportFlight[]>([])

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets[0]) return

      const content = await FileSystem.readAsStringAsync(result.assets[0].uri)
      const data = JSON.parse(content)

      setActivities((data.activities ?? []).map((a: any) => ({
        title: a.title ?? 'Actividad',
        date: a.date ?? null,
        time: a.time ?? null,
        location: a.location ?? null,
        description: a.description ?? null,
        _include: true,
      })))
      setHotels((data.hotels ?? []).map((h: any) => ({
        name: h.name ?? 'Alojamiento',
        address: h.address ?? null,
        checkin: h.checkin ?? null,
        checkout: h.checkout ?? null,
        wifi: h.wifi ?? null,
        safe_code: h.safe_code ?? null,
        _include: true,
      })))
      setFlights((data.flights ?? []).map((f: any) => ({
        flight_number: f.flight_number ?? null,
        from: f.from ?? null,
        to: f.to ?? null,
        departure: f.departure ?? null,
        _include: true,
      })))

      const total = (data.activities?.length ?? 0) + (data.hotels?.length ?? 0) + (data.flights?.length ?? 0)
      if (total === 0) {
        Alert.alert('Archivo vacío', 'El archivo no contiene elementos para importar.')
        return
      }
      setLoaded(true)
    } catch (e: any) {
      Alert.alert('Error al leer el archivo', 'Asegúrate de que es un archivo JSON con el formato correcto.\n\n' + (e.message ?? ''))
    }
  }

  async function handleConfirm() {
    if (!user || !currentGroup) {
      Alert.alert('Espera un momento', 'Aún se está cargando tu grupo. Inténtalo de nuevo en un segundo.')
      return
    }
    setSaving(true)
    try {
     // console.log('IMPORT - user:', user?.id)
     // console.log('IMPORT - group:', currentGroup?.id)
      for (const a of activities.filter(x => x._include)) {
        let startsAt = new Date()
        if (a.date) startsAt = new Date(`${a.date}T${a.time ?? '12:00'}:00`)
        await supabase.from('events').insert({
          group_id: currentGroup!.id,
          created_by: user!.id,
          title: a.title,
          description: a.description,
          location_name: a.location,
          starts_at: startsAt.toISOString(),
          notify_before: 60,
          is_surprise: false,
        })
      }
      for (const h of hotels.filter(x => x._include)) {
        await supabase.from('documents').insert({
          group_id: currentGroup!.id,
          uploaded_by: user!.id,
          type: 'hotel',
          title: h.name,
          storage_path: '',
          hotel_name: h.name,
          address: h.address,
          checkin_date: h.checkin,
          checkout_date: h.checkout,
          wifi_password: h.wifi,
          safe_code: h.safe_code,
        })
      }
      for (const f of flights.filter(x => x._include)) {
        await supabase.from('documents').insert({
          group_id: currentGroup!.id,
          uploaded_by: user!.id,
          type: 'boarding_pass',
          title: f.flight_number ?? 'Vuelo',
          storage_path: '',
          flight_number: f.flight_number,
          departure_airport: f.from,
          arrival_airport: f.to,
          departure_at: f.departure ? new Date(f.departure.replace(' ', 'T') + ':00').toISOString() : null,
        })
      }

      const total = activities.filter(x => x._include).length
        + hotels.filter(x => x._include).length
        + flights.filter(x => x._include).length
      Alert.alert('¡Importado! 🎉', `Se han añadido ${total} elementos.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Error al guardar', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Importar archivo', headerShown: true }} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.emoji}>📂</Text>
          <Text style={styles.title}>Importar plan de viaje</Text>
          <Text style={styles.intro}>
            Selecciona el archivo .json con el plan del viaje. Te mostraremos todo
            para revisar antes de añadirlo.
          </Text>
          <TouchableOpacity style={styles.pickButton} onPress={handlePickFile}>
            <Text style={styles.pickButtonText}>📎 Seleccionar archivo</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Revisar y confirmar', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Revisa lo detectado. Desactiva lo que no quieras importar.</Text>

        {activities.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>📅 Actividades ({activities.length})</Text>
            {activities.map((a, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{a.title}</Text>
                    <Text style={styles.cardMeta}>
                      {a.date ?? 'sin fecha'}{a.time ? ` · ${a.time}` : ''}{a.location ? ` · ${a.location}` : ''}
                    </Text>
                  </View>
                  <Switch value={a._include}
                    onValueChange={v => setActivities(p => p.map((x, j) => j === i ? { ...x, _include: v } : x))}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
                </View>
              </View>
            ))}
          </>
        )}

        {hotels.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🏨 Alojamientos ({hotels.length})</Text>
            {hotels.map((h, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{h.name}</Text>
                    <Text style={styles.cardMeta}>
                      {h.address ?? 'sin dirección'}{h.checkin ? ` · ${h.checkin}` : ''}
                    </Text>
                  </View>
                  <Switch value={h._include}
                    onValueChange={v => setHotels(p => p.map((x, j) => j === i ? { ...x, _include: v } : x))}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
                </View>
              </View>
            ))}
          </>
        )}

        {flights.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>✈️ Vuelos ({flights.length})</Text>
            {flights.map((f, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{f.flight_number ?? 'Vuelo'}</Text>
                    <Text style={styles.cardMeta}>
                      {f.from ?? '?'} → {f.to ?? '?'}{f.departure ? ` · ${f.departure}` : ''}
                    </Text>
                  </View>
                  <Switch value={f._include}
                    onValueChange={v => setFlights(p => p.map((x, j) => j === i ? { ...x, _include: v } : x))}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
                </View>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity style={styles.pickButton} onPress={handleConfirm} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.pickButtonText}>Importar seleccionados</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  emoji: { fontSize: 56, textAlign: 'center', marginTop: 20, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  intro: { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginVertical: 16, textAlign: 'center' },
  pickButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 16,
  },
  pickButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cardMeta: { fontSize: 13, color: COLORS.muted, marginTop: 3 },
})
