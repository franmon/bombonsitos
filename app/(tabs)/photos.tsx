import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, RefreshControl, ActivityIndicator,
  Dimensions, Alert, Modal,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { PhotoMap } from '@/components/PhotoMap'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { capturePhoto, uploadPhoto } from '@/lib/photo-upload'
import { deletePhoto } from '@/lib/delete-helpers'
import { runBackup, getDropboxConnection } from '@/lib/dropbox'
import { COLORS, RADIUS } from '@/constants/theme'
import { Photo, Profile } from '@/types/database'

interface PhotoWithUploader extends Photo {
  uploader: Profile
}

type Tab = 'album' | 'map' | 'capsule'

const { width } = Dimensions.get('window')
const GRID_SIZE = (width - 40 - 16) / 3

function publicUrl(path: string): string {
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function PhotosScreen() {
  const { user, currentGroup, isAdmin } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('album')
  const [photos, setPhotos] = useState<PhotoWithUploader[]>([])
  const [capsuleLocked, setCapsuleLocked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewerPhoto, setViewerPhoto] = useState<PhotoWithUploader | null>(null)

  // Modo selección para enviar a Dropbox
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dropboxConnected, setDropboxConnected] = useState(false)
  const [sending, setSending] = useState(false)

  async function loadData() {
    if (!currentGroup) return

    const { data: photoData } = await supabase
      .from('photos')
      .select('*, uploader:profiles!photos_uploader_fkey(*)')
      .eq('group_id', currentGroup.id)
      .order('taken_at', { ascending: false })

    setPhotos((photoData as PhotoWithUploader[]) ?? [])

    // ¿Dropbox conectado? (para mostrar el botón de enviar)
    const conn = await getDropboxConnection(currentGroup.id)
    setDropboxConnected(conn?.status === 'connected')

    // Estado de la cápsula
    const { data: capsule } = await supabase
      .from('time_capsule')
      .select('*')
      .eq('group_id', currentGroup.id)
      .maybeSingle()

    if (capsule) {
      setCapsuleLocked(capsule.is_locked)
    } else {
      // Crear la cápsula si no existe
      await supabase.from('time_capsule').insert({ group_id: currentGroup.id, is_locked: true })
      setCapsuleLocked(true)
    }

    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [currentGroup])

  useFocusEffect(useCallback(() => { loadData() }, [currentGroup]))

  async function handleAddPhoto(useCamera: boolean, toCapsule: boolean) {
    try {
      setUploading(true)
      const captured = await capturePhoto(useCamera)
      if (!captured) { setUploading(false); return }

      await uploadPhoto(currentGroup!.id, user!.id, captured, null, toCapsule)
      await loadData()
    } catch (e: any) {
      Alert.alert('Error con la foto', e.message)
    } finally {
      setUploading(false)
    }
  }

  function chooseSource(toCapsule: boolean) {
    Alert.alert(
      toCapsule ? 'Añadir a la cápsula' : 'Añadir foto',
      '¿De dónde sacamos la foto?',
      [
        { text: 'Cámara', onPress: () => handleAddPhoto(true, toCapsule) },
        { text: 'Galería', onPress: () => handleAddPhoto(false, toCapsule) },
        { text: 'Cancelar', style: 'cancel' },
      ]
    )
  }

  async function toggleCapsule() {
    if (!currentGroup) return
    const newLocked = !capsuleLocked
    setCapsuleLocked(newLocked)
    await supabase
      .from('time_capsule')
      .update({ is_locked: newLocked, unlocked_at: newLocked ? null : new Date().toISOString() })
      .eq('group_id', currentGroup.id)
  }

  async function handleDeletePhoto(photo: PhotoWithUploader) {
    const deleted = await deletePhoto(photo.id, photo.storage_path)
    if (deleted) {
      setViewerPhoto(null)
      loadData()
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function sendSelectedToDropbox() {
    if (selected.size === 0) return
    setSending(true)
    const res = await runBackup(currentGroup!.id, Array.from(selected))
    setSending(false)
    if (res.ok) {
      Alert.alert('Enviado a Dropbox ✓', `${res.uploaded} foto${res.uploaded === 1 ? '' : 's'} en tu Dropbox.`)
      exitSelectMode()
      loadData()
    } else {
      Alert.alert('Error al enviar', res.error ?? 'Inténtalo de nuevo.')
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  // Separar fotos normales y de cápsula
  const normalPhotos = photos.filter(p => !p.is_capsule)
  const capsulePhotos = photos.filter(p => p.is_capsule)
  const photosWithLocation = normalPhotos.filter(p => p.latitude && p.longitude)

  // Agrupar álbum por día
  const byDay: Record<string, PhotoWithUploader[]> = {}
  for (const p of normalPhotos) {
    const day = new Date(p.taken_at).toISOString().split('T')[0]
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(p)
  }
  const dayGroups = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a))

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'album' && styles.tabActive]} onPress={() => setTab('album')}>
          <Text style={[styles.tabText, tab === 'album' && styles.tabTextActive]}>Álbum</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'map' && styles.tabActive]} onPress={() => setTab('map')}>
          <Text style={[styles.tabText, tab === 'map' && styles.tabTextActive]}>Mapa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'capsule' && styles.tabActive]} onPress={() => setTab('capsule')}>
          <Text style={[styles.tabText, tab === 'capsule' && styles.tabTextActive]}>Cápsula 🔒</Text>
        </TouchableOpacity>
      </View>

      {/* ÁLBUM */}
      {tab === 'album' && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {normalPhotos.length > 0 && dropboxConnected && (
            <View style={styles.selectBar}>
              {selectMode ? (
                <>
                  <TouchableOpacity onPress={exitSelectMode}>
                    <Text style={styles.selectCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendButton, (selected.size === 0 || sending) && styles.sendButtonDisabled]}
                    onPress={sendSelectedToDropbox}
                    disabled={selected.size === 0 || sending}
                  >
                    {sending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.sendButtonText}>Enviar {selected.size} a Dropbox</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={() => setSelectMode(true)}>
                  <Text style={styles.selectStart}>🗂️ Enviar fotos a Dropbox</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {normalPhotos.length > 0 && !selectMode && (
            <TouchableOpacity style={styles.collageLink} onPress={() => router.push('/collage')}>
              <Text style={styles.collageLinkText}>🖼️ Crear collage del viaje</Text>
            </TouchableOpacity>
          )}
          {normalPhotos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📸</Text>
              <Text style={styles.emptyTitle}>Sin fotos aún</Text>
              <Text style={styles.emptyText}>Sube la primera foto del viaje</Text>
            </View>
          ) : (
            dayGroups.map(([day, dayPhotos]) => (
              <View key={day} style={styles.daySection}>
                <Text style={styles.dayHeader}>{formatDay(day)}</Text>
                <View style={styles.grid}>
                  {dayPhotos.map(photo => {
                    const isSel = selected.has(photo.id)
                    const isBacked = !!photo.backed_up_at
                    return (
                      <TouchableOpacity
                        key={photo.id}
                        onPress={() => selectMode ? toggleSelect(photo.id) : setViewerPhoto(photo)}
                      >
                        <Image source={{ uri: publicUrl(photo.storage_path) }} style={styles.gridImage} />
                        {photo.location_name && !selectMode && (
                          <View style={styles.gridLocationBadge}>
                            <Text style={styles.gridLocationText} numberOfLines={1}>📍</Text>
                          </View>
                        )}
                        {/* Indicador de ya respaldada en Dropbox */}
                        {isBacked && !selectMode && (
                          <View style={styles.backedBadge}>
                            <Text style={styles.backedBadgeText}>☁️</Text>
                          </View>
                        )}
                        {/* Check de selección */}
                        {selectMode && (
                          <View style={[styles.selectCheck, isSel && styles.selectCheckOn]}>
                            <Text style={styles.selectCheckText}>{isSel ? '✓' : ''}</Text>
                          </View>
                        )}
                        {selectMode && isBacked && (
                          <View style={styles.backedOverlay}>
                            <Text style={styles.backedOverlayText}>☁️</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* MAPA */}
      {tab === 'map' && (
        photosWithLocation.length === 0 ? (
          <View style={[styles.content, styles.emptyState]}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={styles.emptyTitle}>Sin fotos con ubicación</Text>
            <Text style={styles.emptyText}>Las fotos con localización aparecerán aquí en el mapa</Text>
          </View>
        ) : (
          <PhotoMap photos={photosWithLocation} onMarkerPress={setViewerPhoto} />
        )
      )}

      {/* CÁPSULA */}
      {tab === 'capsule' && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <View style={styles.capsuleHeader}>
            <Text style={styles.capsuleEmoji}>{capsuleLocked ? '🔒' : '🔓'}</Text>
            <Text style={styles.capsuleTitle}>Cápsula del tiempo</Text>
            <Text style={styles.capsuleDesc}>
              {capsuleLocked
                ? `Hay ${capsulePhotos.length} foto${capsulePhotos.length === 1 ? '' : 's'} guardada${capsulePhotos.length === 1 ? '' : 's'}. Se revelarán cuando el organizador abra la cápsula.`
                : 'La cápsula está abierta. ¡Aquí están los recuerdos guardados!'}
            </Text>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.capsuleButton, !capsuleLocked && styles.capsuleButtonOpen]}
                onPress={toggleCapsule}
              >
                <Text style={styles.capsuleButtonText}>
                  {capsuleLocked ? '🔓 Abrir cápsula' : '🔒 Volver a cerrar'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.addCapsuleButton} onPress={() => chooseSource(true)}>
              <Text style={styles.addCapsuleText}>+ Añadir foto a la cápsula</Text>
            </TouchableOpacity>
          </View>

          {/* Mostrar fotos solo si está desbloqueada */}
          {!capsuleLocked && (
            <View style={styles.grid}>
              {capsulePhotos.map(photo => (
                <TouchableOpacity key={photo.id} onPress={() => setViewerPhoto(photo)}>
                  <Image source={{ uri: publicUrl(photo.storage_path) }} style={styles.gridImage} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {capsuleLocked && capsulePhotos.length > 0 && (
            <View style={styles.lockedGrid}>
              {capsulePhotos.map(photo => (
                <View key={photo.id} style={[styles.gridImage, styles.lockedPhoto]}>
                  <Text style={styles.lockedIcon}>🔒</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB añadir (solo en álbum y mapa, no en modo selección) */}
      {tab !== 'capsule' && !selectMode && (
        <TouchableOpacity style={styles.fab} onPress={() => chooseSource(false)} disabled={uploading}>
          {uploading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.fabText}>+</Text>}
        </TouchableOpacity>
      )}

      {/* Visor de foto a pantalla completa */}
      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewerPhoto(null)}>
          {viewerPhoto && (
            <>
              <Image source={{ uri: publicUrl(viewerPhoto.storage_path) }} style={styles.viewerImage} resizeMode="contain" />
              <View style={styles.viewerInfo}>
                <Text style={styles.viewerUploader}>📷 {viewerPhoto.uploader?.name}</Text>
                {viewerPhoto.location_name && (
                  <Text style={styles.viewerLocation}>📍 {viewerPhoto.location_name}</Text>
                )}
                <Text style={styles.viewerDate}>
                  {new Date(viewerPhoto.taken_at).toLocaleString('es-ES')}
                </Text>
                <TouchableOpacity
                  style={styles.viewerDelete}
                  onPress={() => handleDeletePhoto(viewerPhoto)}
                >
                  <Text style={styles.viewerDeleteText}>🗑️ Eliminar foto</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: 4, margin: 20, marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.sm },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: COLORS.muted },
  tabTextActive: { color: '#fff' },
  content: { padding: 20, paddingTop: 4, paddingBottom: 100 },
  collageLink: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', marginBottom: 16,
  },
  collageLinkText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },

  selectBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, minHeight: 40,
  },
  selectStart: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  selectCancel: { fontSize: 15, fontWeight: '500', color: COLORS.muted },
  sendButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 18, paddingVertical: 10, minWidth: 120, alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  backedBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  backedBadgeText: { fontSize: 11 },
  selectCheck: {
    position: 'absolute', top: 4, left: 4,
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  selectCheckOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  selectCheckText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  backedOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  backedOverlayText: { fontSize: 11 },
  emptyState: { alignItems: 'center', paddingTop: 60, flex: 1, justifyContent: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 15, color: COLORS.muted, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
  daySection: { marginBottom: 20 },
  dayHeader: {
    fontSize: 14, fontWeight: '700', color: COLORS.primary,
    marginBottom: 10, textTransform: 'capitalize',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridImage: { width: GRID_SIZE, height: GRID_SIZE, borderRadius: RADIUS.sm, backgroundColor: COLORS.surface },
  gridLocationBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 4,
  },
  gridLocationText: { fontSize: 10, color: '#fff' },
  map: { flex: 1 },
  capsuleHeader: { alignItems: 'center', paddingVertical: 20 },
  capsuleEmoji: { fontSize: 64, marginBottom: 12 },
  capsuleTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  capsuleDesc: { fontSize: 15, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: 20 },
  capsuleButton: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 20,
  },
  capsuleButtonOpen: { backgroundColor: COLORS.muted },
  capsuleButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  addCapsuleButton: { marginTop: 14, padding: 10 },
  addCapsuleText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  lockedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  lockedPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.border },
  lockedIcon: { fontSize: 24 },
  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center',
    justifyContent: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 32, color: '#fff', fontWeight: '300', marginTop: -2 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '70%' },
  viewerInfo: { padding: 24, alignItems: 'center' },
  viewerUploader: { color: '#fff', fontSize: 16, fontWeight: '600' },
  viewerLocation: { color: '#ccc', fontSize: 14, marginTop: 6 },
  viewerDate: { color: '#999', fontSize: 13, marginTop: 6 },
  viewerDelete: {
    marginTop: 16, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: RADIUS.sm,
    paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.danger,
  },
  viewerDeleteText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
