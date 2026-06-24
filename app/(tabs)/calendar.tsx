import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Linking,
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { deleteEvent } from '@/lib/delete-helpers'
import { COLORS, RADIUS } from '@/constants/theme'
import { Event, EventConfirmation, Profile, RSVPStatus } from '@/types/database'

interface EventWithConfirmations extends Event {
  confirmations: (EventConfirmation & { profile: Profile })[]
}

function groupByDay(events: EventWithConfirmations[]) {
  const groups: Record<string, EventWithConfirmations[]> = {}
  for (const ev of events) {
    const day = new Date(ev.starts_at).toISOString().split('T')[0]
    if (!groups[day]) groups[day] = []
    groups[day].push(ev)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

function formatDayHeader(dayKey: string): string {
  const date = new Date(dayKey + 'T00:00:00')
  return date.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function CalendarScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()
  const [events, setEvents] = useState<EventWithConfirmations[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadEvents() {
    if (!currentGroup) return

    let query = supabase
      .from('events')
      .select('*, confirmations:event_confirmations(*, profile:profiles(*))')
      .eq('group_id', currentGroup.id)
      .order('starts_at', { ascending: true })

    if (currentGroup.is_discrete) {
      query = query.eq('is_surprise', false)
    }

    const { data } = await query
    setEvents((data as EventWithConfirmations[]) ?? [])
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadEvents()
    setRefreshing(false)
  }, [currentGroup])

  //useEffect(() => { loadEvents() }, [currentGroup])
  useFocusEffect(
    useCallback(() => {
      loadEvents()
    }, [currentGroup])
  )
  
  async function setRSVP(eventId: string, status: RSVPStatus) {
    if (!user) return
    await supabase
      .from('event_confirmations')
      .upsert(
        { event_id: eventId, user_id: user.id, status, updated_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' }
      )
    loadEvents()
  }

  async function handleDelete(eventId: string, title: string) {
    const deleted = await deleteEvent(eventId, title)
    if (deleted) loadEvents()
  }

  function openMaps(event: EventWithConfirmations) {
    let url = event.maps_url
    if (!url && event.latitude && event.longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
    } else if (!url && event.location_name) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location_name)}`
    }
    if (url) Linking.openURL(url)
  }

  function myStatus(event: EventWithConfirmations): RSVPStatus {
    const mine = event.confirmations?.find(c => c.user_id === user?.id)
    return mine?.status ?? 'pending'
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  const grouped = groupByDay(events)

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {grouped.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>Sin actividades aún</Text>
            <Text style={styles.emptyText}>Añade la primera actividad del viaje</Text>
          </View>
        ) : (
          grouped.map(([dayKey, dayEvents]) => (
            <View key={dayKey} style={styles.daySection}>
              <Text style={styles.dayHeader}>{formatDayHeader(dayKey)}</Text>
              {dayEvents.map(event => {
                const status = myStatus(event)
                const goingCount = event.confirmations?.filter(c => c.status === 'yes').length ?? 0
                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.eventTimeCol}>
                      <Text style={styles.eventTime}>{formatTime(event.starts_at)}</Text>
                      {event.ends_at && (
                        <Text style={styles.eventEndTime}>{formatTime(event.ends_at)}</Text>
                      )}
                    </View>

                    <View style={styles.eventBody}>
                      <View style={styles.eventTitleRow}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        {event.is_surprise && (
                          <Text style={styles.surpriseBadge}>🤫</Text>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDelete(event.id, event.title)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.deleteIcon}>🗑️</Text>
                        </TouchableOpacity>
                      </View>

                      {event.description ? (
                        <Text style={styles.eventDesc}>{event.description}</Text>
                      ) : null}

                      {event.location_name ? (
                        <TouchableOpacity style={styles.locationRow} onPress={() => openMaps(event)}>
                          <Text style={styles.locationText}>📍 {event.location_name}</Text>
                          <Text style={styles.mapsLink}>Ver mapa ›</Text>
                        </TouchableOpacity>
                      ) : null}

                      {goingCount > 0 && (
                        <View style={styles.attendees}>
                          {event.confirmations
                            ?.filter(c => c.status === 'yes')
                            .slice(0, 5)
                            .map(c => (
                              <View key={c.id} style={styles.attendeeAvatar}>
                                <Avatar name={c.profile?.name} url={c.profile?.avatar_url} size={26} showBorder />
                              </View>
                            ))}
                          <Text style={styles.attendeeCount}>{goingCount} van</Text>
                        </View>
                      )}

                      <View style={styles.rsvpRow}>
                        <TouchableOpacity
                          style={[styles.rsvpButton, status === 'yes' && styles.rsvpYes]}
                          onPress={() => setRSVP(event.id, 'yes')}
                        >
                          <Text style={[styles.rsvpText, status === 'yes' && styles.rsvpTextActive]}>
                            ✓ Voy
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rsvpButton, status === 'no' && styles.rsvpNo]}
                          onPress={() => setRSVP(event.id, 'no')}
                        >
                          <Text style={[styles.rsvpText, status === 'no' && styles.rsvpTextActive]}>
                            ✗ No voy
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/event-new')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 15, color: COLORS.muted, marginTop: 6 },
  daySection: { marginBottom: 24 },
  dayHeader: {
    fontSize: 15, fontWeight: '700', color: COLORS.primary,
    marginBottom: 12, textTransform: 'capitalize',
  },
  eventCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  eventTimeCol: { width: 56, alignItems: 'center' },
  eventTime: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  eventEndTime: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  eventBody: { flex: 1, marginLeft: 8 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, flex: 1 },
  surpriseBadge: { fontSize: 16 },
  deleteIcon: { fontSize: 15, marginLeft: 8 },
  eventDesc: { fontSize: 14, color: COLORS.muted, marginTop: 4, lineHeight: 19 },
  locationRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 8,
  },
  locationText: { fontSize: 14, color: COLORS.text },
  mapsLink: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  attendees: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  attendeeAvatar: { marginRight: -8 },
  attendeeCount: { fontSize: 13, color: COLORS.muted, marginLeft: 16 },
  rsvpRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rsvpButton: {
    flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  rsvpYes: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  rsvpNo: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  rsvpText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  rsvpTextActive: { color: '#fff' },
  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center',
    justifyContent: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 32, color: '#fff', fontWeight: '300', marginTop: -2 },
})
