import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView,
} from 'react-native'
import { useState } from 'react'
import { useRouter, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { pickDocument, uploadDocument } from '@/lib/document-upload'
import { scheduleEventNotification } from '@/lib/notifications'
import { COLORS, RADIUS, DOCUMENT_TYPES } from '@/constants/theme'
import { DocumentType } from '@/types/database'

const TYPE_KEYS = Object.keys(DOCUMENT_TYPES) as DocumentType[]

export default function NewDocumentScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()

  const [type, setType] = useState<DocumentType>('boarding_pass')
  const [title, setTitle] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Campos de vuelo
  const [flightNumber, setFlightNumber] = useState('')
  const [departureAirport, setDepartureAirport] = useState('')
  const [arrivalAirport, setArrivalAirport] = useState('')
  const [departureAt, setDepartureAt] = useState('')

  // Campos de hotel
  const [hotelName, setHotelName] = useState('')
  const [address, setAddress] = useState('')
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [wifi, setWifi] = useState('')
  const [safeCode, setSafeCode] = useState('')

  async function handlePickFile() {
    try {
      const doc = await pickDocument()
      if (!doc) return
      setUploading(true)
      const path = await uploadDocument(user!.id, doc)
      setFilePath(path)
      setFileName(doc.name)
    } catch (e: any) {
      Alert.alert('Error al subir', e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!title.trim() && type !== 'hotel') {
      Alert.alert('Falta el título', 'Ponle un nombre al documento.')
      return
    }
    if (type === 'hotel' && !hotelName.trim()) {
      Alert.alert('Falta el nombre', 'Pon el nombre del alojamiento.')
      return
    }

    setSaving(true)
    const { data: doc, error } = await supabase
      .from('documents')
      .insert({
        group_id: currentGroup!.id,
        uploaded_by: user!.id,
        type,
        title: type === 'hotel' ? hotelName.trim() : title.trim(),
        storage_path: filePath ?? '',
        flight_number: type === 'boarding_pass' ? (flightNumber.trim() || null) : null,
        departure_airport: type === 'boarding_pass' ? (departureAirport.trim() || null) : null,
        arrival_airport: type === 'boarding_pass' ? (arrivalAirport.trim() || null) : null,
        departure_at: type === 'boarding_pass' && departureAt ? new Date(departureAt).toISOString() : null,
        hotel_name: type === 'hotel' ? hotelName.trim() : null,
        address: type === 'hotel' ? (address.trim() || null) : null,
        checkin_date: type === 'hotel' && checkin ? checkin : null,
        checkout_date: type === 'hotel' && checkout ? checkout : null,
        wifi_password: type === 'hotel' ? (wifi.trim() || null) : null,
        safe_code: type === 'hotel' ? (safeCode.trim() || null) : null,
      })
      .select()
      .single()

    if (error || !doc) {
      setSaving(false)
      console.log('ERROR EVENTO:', JSON.stringify(error, null, 2))
      Alert.alert('Error al guardar', error?.message)
      return
    }

    // Recordatorio de vuelo: 3 horas antes de la salida
    if (type === 'boarding_pass' && departureAt) {
      try {
        const dep = new Date(departureAt)
        await scheduleEventNotification(
          doc.id,
          `Vuelo ${flightNumber || ''}`.trim(),
          dep.toISOString(),
          180
        )
      } catch (e) {
        console.warn('No se pudo programar el recordatorio de vuelo:', e)
        Alert.alert(
          'Documento guardado',
          'El documento se guardó, pero no se pudo programar el recordatorio del vuelo. Revisa los permisos de notificaciones.'
        )
      }
    }

    setSaving(false)
    router.back()
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Nuevo documento', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Tipo */}
        <Text style={styles.label}>Tipo de documento</Text>
        <View style={styles.typeGrid}>
          {TYPE_KEYS.map(key => {
            const t = DOCUMENT_TYPES[key]
            const active = type === key
            return (
              <TouchableOpacity
                key={key}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => setType(key)}
              >
                <Text style={styles.typeEmoji}>{t.icon}</Text>
                <Text style={[styles.typeText, active && styles.typeTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Campos según tipo */}
        {type === 'boarding_pass' && (
          <>
            <Text style={styles.label}>Número de vuelo</Text>
            <TextInput style={styles.input} value={flightNumber} onChangeText={setFlightNumber}
              placeholder="Ej. IB3456" placeholderTextColor={COLORS.muted} autoCapitalize="characters" />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Origen</Text>
                <TextInput style={styles.input} value={departureAirport} onChangeText={setDepartureAirport}
                  placeholder="BCN" placeholderTextColor={COLORS.muted} autoCapitalize="characters" />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Destino</Text>
                <TextInput style={styles.input} value={arrivalAirport} onChangeText={setArrivalAirport}
                  placeholder="LIS" placeholderTextColor={COLORS.muted} autoCapitalize="characters" />
              </View>
            </View>
            <Text style={styles.label}>Fecha y hora de salida</Text>
            <TextInput style={styles.input} value={departureAt} onChangeText={setDepartureAt}
              placeholder="2026-06-15 14:30" placeholderTextColor={COLORS.muted} />
            <Text style={styles.hint}>Formato: YYYY-MM-DD HH:MM · Avisaremos 3h antes</Text>

            <Text style={styles.label}>Título de referencia</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Ej. Vuelo de ida" placeholderTextColor={COLORS.muted} />
          </>
        )}

        {type === 'hotel' && (
          <>
            <Text style={styles.label}>Nombre del alojamiento *</Text>
            <TextInput style={styles.input} value={hotelName} onChangeText={setHotelName}
              placeholder="Hotel Marina" placeholderTextColor={COLORS.muted} />
            <Text style={styles.label}>Dirección</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress}
              placeholder="Calle, ciudad" placeholderTextColor={COLORS.muted} />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Check-in</Text>
                <TextInput style={styles.input} value={checkin} onChangeText={setCheckin}
                  placeholder="2026-06-15" placeholderTextColor={COLORS.muted} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Check-out</Text>
                <TextInput style={styles.input} value={checkout} onChangeText={setCheckout}
                  placeholder="2026-06-17" placeholderTextColor={COLORS.muted} />
              </View>
            </View>
            <Text style={styles.label}>Contraseña WiFi</Text>
            <TextInput style={styles.input} value={wifi} onChangeText={setWifi}
              placeholder="(opcional)" placeholderTextColor={COLORS.muted} />
            <Text style={styles.label}>Código caja fuerte</Text>
            <TextInput style={styles.input} value={safeCode} onChangeText={setSafeCode}
              placeholder="(opcional)" placeholderTextColor={COLORS.muted} />
          </>
        )}

        {(type === 'ticket' || type === 'other') && (
          <>
            <Text style={styles.label}>Título *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Ej. Entrada discoteca" placeholderTextColor={COLORS.muted} />
          </>
        )}

        {/* Adjuntar archivo */}
        <Text style={styles.label}>Archivo (PDF o imagen)</Text>
        <TouchableOpacity style={styles.fileButton} onPress={handlePickFile} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Text style={styles.fileButtonText}>
              {fileName ? `✓ ${fileName}` : '📎 Adjuntar documento'}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>
          {type === 'hotel' ? 'Opcional para hoteles.' : 'Sube el PDF o foto del documento.'}
        </Text>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Guardar</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: -10, marginBottom: 16 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    fontSize: 16, color: COLORS.text, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeEmoji: { fontSize: 15 },
  typeText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  typeTextActive: { color: '#fff' },
  fileButton: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    borderStyle: 'dashed', marginBottom: 6,
  },
  fileButtonText: { fontSize: 15, color: COLORS.primary, fontWeight: '500' },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
