import { Alert } from 'react-native'
import { supabase } from '@/lib/supabase'

// Borra un registro y, opcionalmente, su archivo en Storage.
// Devuelve true si se borró.
async function confirmAndDelete(
  label: string,
  onDelete: () => Promise<void>
): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      'Eliminar',
      `¿Seguro que quieres eliminar ${label}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete()
              resolve(true)
            } catch (e: any) {
              Alert.alert('Error al eliminar', e.message ?? 'Inténtalo de nuevo.')
              resolve(false)
            }
          },
        },
      ]
    )
  })
}

export function deleteEvent(eventId: string, title: string): Promise<boolean> {
  return confirmAndDelete(`"${title}"`, async () => {
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) throw error
  })
}

export function deleteExpense(expenseId: string, title: string): Promise<boolean> {
  return confirmAndDelete(`el gasto "${title}"`, async () => {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (error) throw error
  })
}

export function deletePhoto(photoId: string, storagePath: string): Promise<boolean> {
  return confirmAndDelete('esta foto', async () => {
    // Borrar el archivo del bucket
    await supabase.storage.from('photos').remove([storagePath])
    // Borrar el registro
    const { error } = await supabase.from('photos').delete().eq('id', photoId)
    if (error) throw error
  })
}

export function deleteDocument(docId: string, title: string, storagePath: string | null): Promise<boolean> {
  return confirmAndDelete(`"${title}"`, async () => {
    if (storagePath) {
      await supabase.storage.from('documents').remove([storagePath])
    }
    const { error } = await supabase.from('documents').delete().eq('id', docId)
    if (error) throw error
  })
}
