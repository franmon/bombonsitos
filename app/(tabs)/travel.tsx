import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Linking, Alert,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { getDocumentUrl } from '@/lib/document-upload'
import { deleteDocument } from '@/lib/delete-helpers'
import { COLORS, RADIUS, DOCUMENT_TYPES } from '@/constants/theme'
import { TravelDocument } from '@/types/database'

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function countdownToFlight(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return null
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(hours / 24)
  if (days > 0) return `en ${days} día${days === 1 ? '' : 's'}`
  if (hours > 0) return `en ${hours}h`
  return 'pronto'
}

export default function TravelScreen() {
  const { currentGroup } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<TravelDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadDocs() {
    if (!currentGroup) return
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('group_id', currentGroup.id)
      .order('created_at', { ascending: false })
    setDocs((data as TravelDocument[]) ?? [])
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadDocs()
    setRefreshing(false)
  }, [currentGroup])

  useFocusEffect(useCallback(() => { loadDocs() }, [currentGroup]))

  async function openDocument(doc: TravelDocument) {
    const url = await getDocumentUrl(doc.storage_path)
    if (url) {
      Linking.openURL(url)
    } else {
      Alert.alert('No se pudo abrir', 'Inténtalo de nuevo.')
    }
  }

  async function handleDelete(doc: TravelDocument) {
    const deleted = await deleteDocument(doc.id, doc.title, doc.storage_path || null)
    if (deleted) loadDocs()
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  const flights = docs.filter(d => d.type === 'boarding_pass')
  const hotels = docs.filter(d => d.type === 'hotel')
  const others = docs.filter(d => d.type === 'ticket' || d.type === 'other')

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {docs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✈️</Text>
            <Text style={styles.emptyTitle}>Sin documentos aún</Text>
            <Text style={styles.emptyText}>Añade vuelos, hoteles o entradas</Text>
          </View>
        )}

        {/* VUELOS */}
        {flights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✈️ Vuelos</Text>
            {flights.map(doc => {
              const countdown = countdownToFlight(doc.departure_at)
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.flightCard}
                  onLongPress={() => handleDelete(doc)}
                  delayLongPress={400}
                  activeOpacity={0.9}
                >
                  <View style={styles.flightHeader}>
                    <Text style={styles.flightNumber}>{doc.flight_number ?? 'Vuelo'}</Text>
                    {countdown && (
                      <View style={styles.countdownBadge}>
                        <Text style={styles.countdownText}>Sale {countdown}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.flightRoute}>
                    <View style={styles.airport}>
                      <Text style={styles.airportCode}>{doc.departure_airport ?? '—'}</Text>
                      <Text style={styles.airportTime}>{formatDateTime(doc.departure_at)}</Text>
                    </View>
                    <Text style={styles.flightArrow}>→</Text>
                    <View style={styles.airport}>
                      <Text style={styles.airportCode}>{doc.arrival_airport ?? '—'}</Text>
                      <Text style={styles.airportTime}>{formatDateTime(doc.arrival_at)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.docButton} onPress={() => openDocument(doc)}>
                    <Text style={styles.docButtonText}>Ver tarjeta de embarque</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* HOTELES */}
        {hotels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏨 Alojamiento</Text>
            {hotels.map(doc => (
              <TouchableOpacity
                key={doc.id}
                style={styles.hotelCard}
                onLongPress={() => handleDelete(doc)}
                delayLongPress={400}
                activeOpacity={0.9}
              >
                <Text style={styles.hotelName}>{doc.hotel_name ?? doc.title}</Text>
                {doc.address && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doc.address!)}`)}
                  >
                    <Text style={styles.hotelAddress}>📍 {doc.address}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.hotelDates}>
                  {doc.checkin_date && (
                    <View style={styles.hotelDateBox}>
                      <Text style={styles.hotelDateLabel}>Check-in</Text>
                      <Text style={styles.hotelDateValue}>
                        {new Date(doc.checkin_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}
                  {doc.checkout_date && (
                    <View style={styles.hotelDateBox}>
                      <Text style={styles.hotelDateLabel}>Check-out</Text>
                      <Text style={styles.hotelDateValue}>
                        {new Date(doc.checkout_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}
                </View>
                {(doc.wifi_password || doc.safe_code) && (
                  <View style={styles.hotelExtras}>
                    {doc.wifi_password && (
                      <Text style={styles.hotelExtra}>📶 WiFi: {doc.wifi_password}</Text>
                    )}
                    {doc.safe_code && (
                      <Text style={styles.hotelExtra}>🔐 Caja fuerte: {doc.safe_code}</Text>
                    )}
                  </View>
                )}
                {doc.storage_path && (
                  <TouchableOpacity style={styles.docButton} onPress={() => openDocument(doc)}>
                    <Text style={styles.docButtonText}>Ver reserva</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* OTROS */}
        {others.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎟️ Entradas y bonos</Text>
            {others.map(doc => {
              const t = DOCUMENT_TYPES[doc.type] ?? DOCUMENT_TYPES.other
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.docRow}
                  onPress={() => openDocument(doc)}
                  onLongPress={() => handleDelete(doc)}
                  delayLongPress={400}
                >
                  <Text style={styles.docIcon}>{t.icon}</Text>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docOpen}>Ver ›</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/document-new')}>
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
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  flightCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  flightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  flightNumber: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  countdownBadge: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 4 },
  countdownText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  flightRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  airport: { alignItems: 'center', flex: 1 },
  airportCode: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  airportTime: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  flightArrow: { fontSize: 20, color: COLORS.primary, marginHorizontal: 12 },
  docButton: {
    marginTop: 14, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingVertical: 10, alignItems: 'center',
  },
  docButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  hotelCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  hotelName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  hotelAddress: { fontSize: 14, color: COLORS.primary, marginTop: 6 },
  hotelDates: { flexDirection: 'row', gap: 24, marginTop: 14 },
  hotelDateBox: {},
  hotelDateLabel: { fontSize: 12, color: COLORS.muted },
  hotelDateValue: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  hotelExtras: { marginTop: 14, gap: 6, backgroundColor: COLORS.background, borderRadius: RADIUS.sm, padding: 12 },
  hotelExtra: { fontSize: 14, color: COLORS.text },

  docRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  docIcon: { fontSize: 22, marginRight: 12 },
  docTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text },
  docOpen: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },

  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center',
    justifyContent: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 32, color: '#fff', fontWeight: '300', marginTop: -2 },
})
