import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Switch, Platform, KeyboardAvoidingView,
} from 'react-native'
import { useState } from 'react'
import { useRouter, Stack } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { scheduleEventNotification } from '@/lib/notifications'
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete'
import { COLORS, RADIUS } from '@/constants/theme'

const NOTIFY_OPTIONS = [
  { label: 'Sin aviso', value: 0 },
  { label: '15 min antes', value: 15 },
  { label: '30 min antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '2 horas antes', value: 120 },
]

export default function NewEventScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationName, setLocationName] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(new Date())
  const [hasEnd, setHasEnd] = useState(false)
  const [endDate, setEndDate] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000))
  const [notifyBefore, setNotifyBefore] = useState(60)
  const [saving, setSaving] = useState(false)

  // Control de los pickers (Android los muestra de forma puntual)
  const [showStartDate, setShowStartDate] = useState(false)
  const [showStartTime, setShowStartTime] = useState(false)
  const [showEndTime, setShowEndTime] = useState(false)

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Falta el título', 'Ponle un nombre a la actividad.')
      return
    }
    if (hasEnd && endDate <= startDate) {
      Alert.alert('Horas incorrectas', 'La hora de fin debe ser posterior a la de inicio.')
      return
    }

    setSaving(true)

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        group_id: currentGroup!.id,
        created_by: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        location_name: locationName.trim() || null,
        latitude: latitude,
        longitude: longitude,
        starts_at: startDate.toISOString(),
        ends_at: hasEnd ? endDate.toISOString() : null,
        notify_before: notifyBefore,
      })
      .select()
      .single()

    if (error || !event) {
      setSaving(false)
      Alert.alert('Error al crear', error?.message)
      return
    }

    // Programar notificación local si corresponde
    if (notifyBefore > 0) {
      try {
        await scheduleEventNotification(event.id, title.trim(), startDate.toISOString(), notifyBefore)
      } catch {
        // Si falla la notificación, no bloqueamos la creación
      }
    }

    setSaving(false)
    router.back()
  }

  function onChangeStartDate(_: any, selected?: Date) {
    setShowStartDate(false)
    if (selected) {
      const newDate = new Date(startDate)
      newDate.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
      setStartDate(newDate)
    }
  }

  function onChangeStartTime(_: any, selected?: Date) {
    setShowStartTime(false)
    if (selected) {
      const newDate = new Date(startDate)
      newDate.setHours(selected.getHours(), selected.getMinutes())
      setStartDate(newDate)
    }
  }

  function onChangeEndTime(_: any, selected?: Date) {
    setShowEndTime(false)
    if (selected) {
      const newDate = new Date(endDate)
      newDate.setFullYear(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      newDate.setHours(selected.getHours(), selected.getMinutes())
      setEndDate(newDate)
    }
  }

  const dateLabel = startDate.toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
  const startTimeLabel = startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const endTimeLabel = endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Nueva actividad', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Título *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ej. Cena en el restaurante"
          placeholderTextColor={COLORS.muted}
        />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Detalles, dress code, qué llevar..."
          placeholderTextColor={COLORS.muted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Lugar</Text>
        <PlacesAutocomplete
          value={locationName}
          onChangeText={setLocationName}
          onSelectPlace={(place) => {
            setLocationName(place.name)
            setLatitude(place.latitude)
            setLongitude(place.longitude)
          }}
          placeholder="Busca el sitio (restaurante, bar, dirección...)"
        />
        <Text style={styles.hint}>Empieza a escribir y elige de las sugerencias de Google.</Text>

        {/* Fecha y hora */}
        <Text style={styles.label}>Fecha y hora de inicio</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDate(true)}>
            <Text style={styles.dateButtonText}>{dateLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartTime(true)}>
            <Text style={styles.dateButtonText}>{startTimeLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Hora de fin opcional */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Añadir hora de fin</Text>
          <Switch
            value={hasEnd}
            onValueChange={setHasEnd}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>
        {hasEnd && (
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndTime(true)}>
            <Text style={styles.dateButtonText}>Termina a las {endTimeLabel}</Text>
          </TouchableOpacity>
        )}

        {/* Aviso */}
        <Text style={[styles.label, { marginTop: 20 }]}>Recordatorio</Text>
        <View style={styles.notifyGrid}>
          {NOTIFY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.notifyChip, notifyBefore === opt.value && styles.notifyChipActive]}
              onPress={() => setNotifyBefore(opt.value)}
            >
              <Text style={[styles.notifyChipText, notifyBefore === opt.value && styles.notifyChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Crear actividad</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* Pickers nativos */}
      {showStartDate && (
        <DateTimePicker value={startDate} mode="date" onChange={onChangeStartDate} />
      )}
      {showStartTime && (
        <DateTimePicker value={startDate} mode="time" onChange={onChangeStartTime} />
      )}
      {showEndTime && (
        <DateTimePicker value={endDate} mode="time" onChange={onChangeEndTime} />
      )}
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
  textArea: { minHeight: 80 },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dateButton: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  dateButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 12, marginBottom: 8,
  },
  notifyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notifyChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  notifyChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  notifyChipText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  notifyChipTextActive: { color: '#fff' },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
