import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  Dimensions, Platform,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import { captureRef } from 'react-native-view-shot'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'
import { Photo } from '@/types/database'

const { width } = Dimensions.get('window')
const COLLAGE_SIZE = width - 48
const COLS = 3

function publicUrl(path: string): string {
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export default function CollageScreen() {
  const { currentGroup } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const collageRef = useRef<View>(null)

  useEffect(() => {
    if (!currentGroup) return
    supabase
      .from('photos')
      .select('*')
      .eq('group_id', currentGroup.id)
      .eq('is_capsule', false)
      .order('taken_at', { ascending: true })
      .then(({ data }) => {
        setPhotos((data as Photo[]) ?? [])
        setLoading(false)
      })
  }, [currentGroup])

  // Cuadrícula: limitamos a 9 fotos para un collage limpio (3x3)
  const collagePhotos = photos.slice(0, 9)
  const cellSize = COLLAGE_SIZE / COLS

  async function handleExport() {
    if (collagePhotos.length === 0) return
    setExporting(true)
    try {
      // Capturar la vista del collage como imagen
      const uri = await captureRef(collageRef, {
        format: 'png',
        quality: 1,
      })

      // Compartir
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri)
      } else {
        // Si no hay share, guardar en galería
        const { status } = await MediaLibrary.requestPermissionsAsync()
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(uri)
          Alert.alert('Guardado', 'El collage se ha guardado en tu galería.')
        }
      }
    } catch (e: any) {
      Alert.alert('Error al exportar', e.message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Collage', headerShown: true }} />
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Collage del viaje', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {collagePhotos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🖼️</Text>
            <Text style={styles.emptyTitle}>Sin fotos para el collage</Text>
            <Text style={styles.emptyText}>Sube fotos al álbum y vuelve aquí</Text>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              Collage con las primeras {collagePhotos.length} fotos del viaje.
              Puedes guardarlo o compartirlo.
            </Text>

            {/* Vista que se captura */}
            <View ref={collageRef} collapsable={false} style={styles.collage}>
              <View style={styles.collageHeader}>
                <Text style={styles.collageTitle}>
                  {currentGroup?.groom_name ? `Despedida de ${currentGroup.groom_name}` : currentGroup?.name}
                </Text>
              </View>
              <View style={styles.grid}>
                {collagePhotos.map((photo, i) => (
                  <Image
                    key={photo.id}
                    source={{ uri: publicUrl(photo.storage_path) }}
                    style={{ width: cellSize, height: cellSize }}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.exportButton} onPress={handleExport} disabled={exporting}>
              {exporting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.exportButtonText}>📤 Guardar / Compartir collage</Text>}
            </TouchableOpacity>

            {photos.length > 9 && (
              <Text style={styles.note}>
                Tienes {photos.length} fotos. El collage usa las primeras 9 para que
                quede limpio.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingBottom: 40 },
  intro: { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 15, color: COLORS.muted, marginTop: 6 },
  collage: {
    width: COLLAGE_SIZE,
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  collageHeader: { padding: 14, alignItems: 'center' },
  collageTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  exportButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  exportButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 16, lineHeight: 19 },
})
