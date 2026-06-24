import MapView, { Marker } from 'react-native-maps'
import { StyleSheet } from 'react-native'
import { Photo } from '@/types/database'

interface PhotoMapProps<T extends Photo> {
  photos: T[]
  onMarkerPress: (photo: T) => void
}

// Versión nativa (iOS/Android): mapa real con marcadores
export function PhotoMap<T extends Photo>({ photos, onMarkerPress }: PhotoMapProps<T>) {
  if (photos.length === 0) return null
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: photos[0].latitude!,
        longitude: photos[0].longitude!,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
    >
      {photos.map(photo => (
        <Marker
          key={photo.id}
          coordinate={{ latitude: photo.latitude!, longitude: photo.longitude! }}
          title={photo.location_name ?? 'Foto'}
          onCalloutPress={() => onMarkerPress(photo)}
        />
      ))}
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: { flex: 1 },
})
