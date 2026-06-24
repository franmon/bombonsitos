import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView,
} from 'react-native'
import { useState } from 'react'
import { useRouter, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'

export default function NewPollScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [saving, setSaving] = useState(false)

  function updateOption(index: number, value: string) {
    setOptions(prev => prev.map((o, i) => (i === index ? value : o)))
  }

  function addOption() {
    if (options.length < 8) setOptions(prev => [...prev, ''])
  }

  function removeOption(index: number) {
    if (options.length > 2) setOptions(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const validOptions = options.map(o => o.trim()).filter(Boolean)
    if (!question.trim()) {
      Alert.alert('Falta la pregunta', '¿Qué quieres preguntar?')
      return
    }
    if (validOptions.length < 2) {
      Alert.alert('Faltan opciones', 'Pon al menos dos opciones.')
      return
    }

    setSaving(true)
    const optionsData = validOptions.map((text, i) => ({ id: `opt${i}`, text }))

    const { error } = await supabase.from('polls').insert({
      group_id: currentGroup!.id,
      created_by: user!.id,
      question: question.trim(),
      options: optionsData,
      is_open: true,
    })

    setSaving(false)
    if (error) {
      Alert.alert('Error al crear', error.message)
    } else {
      router.back()
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Nueva votación', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Pregunta *</Text>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Ej. ¿Dónde cenamos el sábado?"
          placeholderTextColor={COLORS.muted}
          multiline
        />

        <Text style={styles.label}>Opciones *</Text>
        {options.map((opt, i) => (
          <View key={i} style={styles.optionRow}>
            <TextInput
              style={styles.optionInput}
              value={opt}
              onChangeText={v => updateOption(i, v)}
              placeholder={`Opción ${i + 1}`}
              placeholderTextColor={COLORS.muted}
            />
            {options.length > 2 && (
              <TouchableOpacity onPress={() => removeOption(i)} style={styles.removeButton}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {options.length < 8 && (
          <TouchableOpacity style={styles.addButton} onPress={addOption}>
            <Text style={styles.addText}>+ Añadir opción</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Crear votación</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    fontSize: 16, color: COLORS.text, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  optionInput: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14,
    fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  removeButton: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  removeText: { fontSize: 16, color: COLORS.danger },
  addButton: { padding: 12, marginTop: 4 },
  addText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
