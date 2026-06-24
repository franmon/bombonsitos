import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView,
} from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'

export default function SurveyScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()
  const [overall, setOverall] = useState(0)
  const [highlights, setHighlights] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [saving, setSaving] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentGroup || !user) return
    supabase
      .from('trip_surveys')
      .select('*')
      .eq('group_id', currentGroup.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOverall(data.overall)
          setHighlights(data.highlights ?? '')
          setSuggestions(data.suggestions ?? '')
          setAlreadyDone(true)
        }
        setLoading(false)
      })
  }, [currentGroup, user])

  async function handleSubmit() {
    if (overall === 0) {
      Alert.alert('Falta la valoración', 'Pon una puntuación general del viaje.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('trip_surveys')
      .upsert(
        {
          group_id: currentGroup!.id,
          user_id: user!.id,
          overall,
          highlights: highlights.trim() || null,
          suggestions: suggestions.trim() || null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'group_id,user_id' }
      )

    setSaving(false)
    if (error) {
      Alert.alert('Error al enviar', error.message)
    } else {
      Alert.alert('¡Gracias! 🎉', 'Tu valoración se ha guardado.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Encuesta', headerShown: true }} />
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Encuesta del viaje', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {alreadyDone && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneText}>Ya enviaste tu valoración. Puedes editarla.</Text>
          </View>
        )}

        <Text style={styles.title}>¿Qué tal el viaje?</Text>
        <Text style={styles.subtitle}>Tu opinión ayuda para la próxima</Text>

        {/* Estrellas */}
        <Text style={styles.label}>Valoración general</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setOverall(n)}>
              <Text style={[styles.star, n <= overall && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Lo mejor del viaje</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={highlights}
          onChangeText={setHighlights}
          placeholder="¿Qué actividad o momento fue el mejor?"
          placeholderTextColor={COLORS.muted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Sugerencias</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={suggestions}
          onChangeText={setSuggestions}
          placeholder="¿Qué mejorarías para la próxima?"
          placeholderTextColor={COLORS.muted}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>{alreadyDone ? 'Actualizar' : 'Enviar valoración'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingBottom: 40 },
  doneBanner: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 20,
  },
  doneText: { fontSize: 13, color: COLORS.primary, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 15, color: COLORS.muted, marginTop: 4, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  star: { fontSize: 40, color: COLORS.border },
  starActive: { color: '#F59E0B' },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    fontSize: 16, color: COLORS.text, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  textArea: { minHeight: 90 },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 12,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
