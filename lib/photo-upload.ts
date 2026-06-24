import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'
import { decode } from 'base64-arraybuffer'

export interface CapturedPhoto {
  asset: ImagePicker.ImagePickerAsset
  latitude: number | null
  longitude: number | null
  locationName: string | null
}

// Pedir permiso y tomar/elegir foto, capturando la ubicación actual
export async function capturePhoto(useCamera: boolean): Promise<CapturedPhoto | null> {
  // Permiso de cámara o galería
  if (useCamera) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') throw new Error('Necesitamos permiso para usar la cámara.')
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') throw new Error('Necesitamos permiso para acceder a tus fotos.')
  }

  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.7, exif: true })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, exif: true })

  if (result.canceled || !result.assets[0]) return null
  const asset = result.assets[0]

  // Intentar capturar la ubicación
  let latitude: number | null = null
  let longitude: number | null = null
  let locationName: string | null = null

  // 1. Si la foto trae EXIF con GPS, usarlo
  if (asset.exif?.GPSLatitude && asset.exif?.GPSLongitude) {
    latitude = asset.exif.GPSLatitude
    longitude = asset.exif.GPSLongitude
  } else {
    // 2. Si no, usar la ubicación actual del móvil
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
      }
    } catch {
      // sin ubicación, no pasa nada
    }
  }

  // Geocodificación inversa para obtener nombre del lugar
  if (latitude && longitude) {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude })
      if (places[0]) {
        const p = places[0]
        locationName = [p.name, p.city].filter(Boolean).join(', ') || p.region || null
      }
    } catch {
      // sin nombre, no pasa nada
    }
  }

  return { asset, latitude, longitude, locationName }
}

// Subir la foto a Storage y crear el registro en la tabla photos
export async function uploadPhoto(
  groupId: string,
  userId: string,
  photo: CapturedPhoto,
  caption: string | null,
  isCapsule: boolean
): Promise<void> {
  const ext = photo.asset.uri.split('.').pop() ?? 'jpg'
  const fileName = `${groupId}/${Date.now()}_${userId}.${ext}`

  const base64 = await FileSystem.readAsStringAsync(photo.asset.uri, {
    encoding: 'base64',
  })

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(fileName, decode(base64), {
      contentType: photo.asset.mimeType ?? 'image/jpeg',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)

  const { error: dbError } = await supabase.from('photos').insert({
    group_id: groupId,
    uploaded_by: userId,
    storage_path: fileName,
    caption,
    latitude: photo.latitude,
    longitude: photo.longitude,
    location_name: photo.locationName,
    is_capsule: isCapsule,
    taken_at: new Date().toISOString(),
  })

  if (dbError) throw dbError
}
