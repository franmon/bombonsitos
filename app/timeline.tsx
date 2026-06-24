import {
  View, Text, ScrollView, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'

interface TimelineItem {
  id: string
  type: 'event' | 'photo'
  title: string
  date: string
  location?: string | null
  imagePath?: string | null
}

function publicUrl(path: string): string {
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export default function TimelineScreen() {
  const { currentGroup } = useAuth()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  async function loadTimeline() {
    if (!currentGroup) return

    const { data: events } = await supabase
      .from('events')
      .select('id, title, starts_at, location_name')
      .eq('group_id', currentGroup.id)

    const { data: photos } = await supabase
      .from('photos')
      .select('id, caption, taken_at, location_name, storage_path')
      .eq('group_id', currentGroup.id)
      .eq('is_capsule', false)

    const eventItems: TimelineItem[] = (events ?? []).map(e => ({
      id: 'e' + e.id,
      type: 'event',
      title: e.title,
      date: e.starts_at,
      location: e.location_name,
    }))

    const photoItems: TimelineItem[] = (photos ?? []).map(p => ({
      id: 'p' + p.id,
      type: 'photo',
      title: p.caption || 'Foto',
      date: p.taken_at,
      location: p.location_name,
      imagePath: p.storage_path,
    }))

    const all = [...eventItems, ...photoItems].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    setItems(all)
    setLoading(false)
  }

  useFocusEffect(useCallback(() => { loadTimeline() }, [currentGroup]))

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Timeline', headerShown: true }} />
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  // Agrupar por día
  const byDay: Record<string, TimelineItem[]> = {}
  for (const item of items) {
    const day = new Date(item.date).toISOString().split('T')[0]
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(item)
  }
  const days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Timeline del viaje', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {days.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🧭</Text>
            <Text style={styles.emptyTitle}>El viaje aún no ha empezado</Text>
            <Text style={styles.emptyText}>
              Aquí se irá montando la historia del viaje con las actividades y fotos
            </Text>
          </View>
        ) : (
          days.map(([day, dayItems]) => (
            <View key={day} style={styles.daySection}>
              <Text style={styles.dayHeader}>
                {new Date(day + 'T00:00:00').toLocaleDateString('es-ES', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </Text>
              {dayItems.map(item => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.dot, item.type === 'photo' && styles.dotPhoto]} />
                    <View style={styles.line} />
                  </View>
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineTime}>
                        {new Date(item.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={styles.timelineType}>
                        {item.type === 'event' ? '📅' : '📸'}
                      </Text>
                    </View>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    {item.location && (
                      <Text style={styles.timelineLocation}>📍 {item.location}</Text>
                    )}
                    {item.imagePath && (
                      <Image source={{ uri: publicUrl(item.imagePath) }} style={styles.timelineImage} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 15, color: COLORS.muted, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  daySection: { marginBottom: 10 },
  dayHeader: {
    fontSize: 15, fontWeight: '700', color: COLORS.primary,
    marginBottom: 12, marginTop: 12, textTransform: 'capitalize',
  },
  timelineRow: { flexDirection: 'row' },
  timelineLine: { width: 24, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, marginTop: 16 },
  dotPhoto: { backgroundColor: COLORS.accent },
  line: { flex: 1, width: 2, backgroundColor: COLORS.border, marginTop: 4 },
  timelineCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14,
    marginBottom: 12, marginLeft: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineTime: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  timelineType: { fontSize: 14 },
  timelineTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  timelineLocation: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  timelineImage: { width: '100%', height: 160, borderRadius: RADIUS.sm, marginTop: 10 },
})
