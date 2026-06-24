import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { COLORS, RADIUS } from '@/constants/theme'

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY

export interface SelectedPlace {
  name: string
  latitude: number | null
  longitude: number | null
}

interface PlacesAutocompleteProps {
  value: string
  onChangeText: (text: string) => void
  onSelectPlace: (place: SelectedPlace) => void
  placeholder?: string
}

interface Suggestion {
  placeId: string
  text: string
}

export function PlacesAutocomplete({
  value, onChangeText, onSelectPlace, placeholder,
}: PlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(text: string) {
    onChangeText(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.trim().length < 3) {
      setSuggestions([])
      setShowList(false)
      return
    }

    // Esperar 400ms tras dejar de escribir para no gastar peticiones de más
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 400)
  }

async function fetchSuggestions(text: string) {
    if (!PLACES_KEY) return
    setLoading(true)
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PLACES_KEY,
        },
        body: JSON.stringify({
          input: text,
          languageCode: 'es',
        }),
      })
      const data = await res.json()

      const list: Suggestion[] = (data.suggestions ?? [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          placeId: s.placePrediction.placeId,
          text: s.placePrediction.text?.text ?? '',
        }))
      setSuggestions(list)
      setShowList(list.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(suggestion: Suggestion) {
    onChangeText(suggestion.text)
    setShowList(false)
    setSuggestions([])

    // Obtener coordenadas del lugar elegido
    if (!PLACES_KEY) {
      onSelectPlace({ name: suggestion.text, latitude: null, longitude: null })
      return
    }
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': PLACES_KEY,
            'X-Goog-FieldMask': 'location,displayName',
          },
        }
      )
      const data = await res.json()
      onSelectPlace({
        name: suggestion.text,
        latitude: data.location?.latitude ?? null,
        longitude: data.location?.longitude ?? null,
      })
    } catch {
      onSelectPlace({ name: suggestion.text, latitude: null, longitude: null })
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder ?? 'Buscar lugar...'}
          placeholderTextColor={COLORS.muted}
        />
        {loading && <ActivityIndicator size="small" color={COLORS.primary} style={styles.spinner} />}
      </View>

      {showList && (
        <View style={styles.list}>
          {suggestions.map(s => (
            <TouchableOpacity key={s.placeId} style={styles.item} onPress={() => handleSelect(s)}>
              <Text style={styles.itemIcon}>📍</Text>
              <Text style={styles.itemText} numberOfLines={2}>{s.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 },
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    fontSize: 16, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  spinner: { position: 'absolute', right: 16 },
  list: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  itemIcon: { fontSize: 16 },
  itemText: { flex: 1, fontSize: 15, color: COLORS.text },
})
