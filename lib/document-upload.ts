import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'
import { decode } from 'base64-arraybuffer'

export interface PickedDocument {
  uri: string
  name: string
  mimeType: string
}

// Elegir un documento (PDF o imagen) del dispositivo
export async function pickDocument(): Promise<PickedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  })

  if (result.canceled || !result.assets[0]) return null
  const asset = result.assets[0]
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
  }
}

// Subir un documento al bucket privado 'documents'
export async function uploadDocument(
  userId: string,
  doc: PickedDocument
): Promise<string> {
  const ext = doc.name.split('.').pop() ?? 'pdf'
  const fileName = `${userId}/${Date.now()}.${ext}`

  const base64 = await FileSystem.readAsStringAsync(doc.uri, {
    encoding: 'base64',
  })

  const { error } = await supabase.storage
    .from('documents')
    .upload(fileName, decode(base64), {
      contentType: doc.mimeType,
      upsert: false,
    })

  if (error) throw error
  return fileName
}

// Obtener una URL firmada temporal para ver un documento privado
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60) // 1 hora

  if (error) return null
  return data.signedUrl
}
