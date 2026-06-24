import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'
import { decode } from 'base64-arraybuffer'

// Pide permiso y abre la galería para elegir una imagen
export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('Necesitamos permiso para acceder a tus fotos.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  })

  if (result.canceled || !result.assets[0]) return null
  return result.assets[0]
}

// Sube una imagen a un bucket y devuelve la URL pública
export async function uploadImage(
  bucket: string,
  userId: string,
  asset: ImagePicker.ImagePickerAsset
): Promise<string> {
  const ext = asset.uri.split('.').pop() ?? 'jpg'
  const fileName = `${userId}/${Date.now()}.${ext}`

  // Leer el archivo como base64
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: 'base64',
  })

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, decode(base64), {
      contentType: asset.mimeType ?? 'image/jpeg',
      upsert: true,
    })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
  return data.publicUrl
}
