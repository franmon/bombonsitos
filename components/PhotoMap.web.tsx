import { View, Text, StyleSheet } from 'react-native'
import { Photo } from '@/types/database'
import { COLORS } from '@/constants/theme'

interface PhotoMapProps<T extends Photo> {
  photos: T[]
  onMarkerPress: (photo: T) => void
}

// Versión web: el mapa nativo no está disponible, mostramos una lista de lugares
export function PhotoMap<T extends Photo>({ photos, onMarkerPress }: PhotoMapProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.title}>Mapa disponible en la app móvil</Text>
      <Text style={styles.subtitle}>
        El mapa interactivo funciona en la app de iOS/Android. En la versión web
        puedes ver las fotos en el Álbum.
      </Text>
      {photos.length > 0 && (
        <View style={styles.list}>
          {photos.slice(0, 10).map(photo => (
            <Text key={photo.id} style={styles.place}>
              📍 {photo.location_name ?? 'Ubicación sin nombre'}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  list: { marginTop: 24, alignSelf: 'stretch' },
  place: { fontSize: 14, color: COLORS.text, paddingVertical: 6 },
})
