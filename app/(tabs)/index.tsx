import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Share, RefreshControl,
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'
import { Event, Expense } from '@/types/database'

function useCountdown(date: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    if (!date) return
    const target = new Date(date).getTime()

    function tick() {
      const now = Date.now()
      const diff = target - now
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
      })
    }

    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [date])

  return timeLeft
}

export default function HomeScreen() {
  const { currentGroup, profile } = useAuth()
  const router = useRouter()
  const countdown = useCountdown(currentGroup?.countdown_date ?? null)
  const [nextEvent, setNextEvent] = useState<Event | null>(null)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  async function loadData() {
    if (!currentGroup) return

    // Próximo evento
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('group_id', currentGroup.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)

    setNextEvent(events?.[0] ?? null)

    // Total de gastos
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('group_id', currentGroup.id)

    setTotalExpenses(expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0)

    // Número de miembros
    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', currentGroup.id)

    setMemberCount(count ?? 0)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [currentGroup])

  useEffect(() => { loadData() }, [currentGroup])

  async function shareCode() {
    if (!currentGroup) return
    await Share.share({
      message: `¡Únete a la despedida de ${currentGroup.groom_name ?? 'la despedida'}! 🎉\nUsa el código: ${currentGroup.code}\nDescarga la app BachelorApp para entrar.`,
    })
  }

  const hasCoutdown = !!currentGroup?.countdown_date
  const eventDate = nextEvent ? new Date(nextEvent.starts_at) : null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Saludo */}
      <Text style={styles.greeting}>Hola, {profile?.name?.split(' ')[0]} 👋</Text>

      {/* Contador regresivo */}
      {hasCoutdown && (
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>
            Quedan para la despedida de{' '}
            <Text style={styles.groomName}>{currentGroup?.groom_name ?? 'la despedida'}</Text>
          </Text>
          <View style={styles.countdownRow}>
            <CountdownUnit value={countdown.days} unit="días" />
            <Text style={styles.countdownSep}>:</Text>
            <CountdownUnit value={countdown.hours} unit="horas" />
            <Text style={styles.countdownSep}>:</Text>
            <CountdownUnit value={countdown.minutes} unit="min" />
          </View>
        </View>
      )}

      {/* Código del grupo */}
      <TouchableOpacity style={styles.codeCard} onPress={shareCode}>
        <View>
          <Text style={styles.codeLabel}>Código del grupo</Text>
          <Text style={styles.codeValue}>{currentGroup?.code}</Text>
        </View>
        <View style={styles.shareButton}>
          <Text style={styles.shareButtonText}>Compartir</Text>
        </View>
      </TouchableOpacity>

      {/* Stats rápidas */}
      <View style={styles.statsRow}>
        <StatCard icon="👥" value={memberCount} label="en el grupo" onPress={() => router.push('/(tabs)/group')} />
        <StatCard icon="💸" value={`€${totalExpenses.toFixed(0)}`} label="gastado" onPress={() => router.push('/(tabs)/expenses')} />
      </View>

      {/* Próxima actividad */}
      <Text style={styles.sectionTitle}>Próxima actividad</Text>
      {nextEvent ? (
        <TouchableOpacity
          style={styles.eventCard}
          onPress={() => router.push('/(tabs)/calendar')}
        >
          <Text style={styles.eventTitle}>{nextEvent.title}</Text>
          <Text style={styles.eventDate}>
            {eventDate?.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}
            {eventDate?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {nextEvent.location_name && (
            <Text style={styles.eventLocation}>📍 {nextEvent.location_name}</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => router.push('/(tabs)/calendar')}
        >
          <Text style={styles.emptyText}>No hay actividades aún</Text>
          <Text style={styles.emptyAction}>Añadir primera actividad →</Text>
        </TouchableOpacity>
      )}

      {/* Accesos rápidos */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Más</Text>
      <View style={styles.quickGrid}>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/polls')}>
          <Text style={styles.quickIcon}>🗳️</Text>
          <Text style={styles.quickLabel}>Votaciones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/timeline')}>
          <Text style={styles.quickIcon}>🧭</Text>
          <Text style={styles.quickLabel}>Timeline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/survey')}>
          <Text style={styles.quickIcon}>⭐</Text>
          <Text style={styles.quickLabel}>Encuesta</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.importCard} onPress={() => router.push('/import-file')}>
        <Text style={styles.importIcon}>📂</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.importTitle}>Importar plan de viaje</Text>
          <Text style={styles.importDesc}>Carga las actividades desde un archivo</Text>
        </View>
        <Text style={styles.importArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function CountdownUnit({ value, unit }: { value: number; unit: string }) {
  return (
    <View style={styles.countdownUnit}>
      <Text style={styles.countdownNumber}>{String(value).padStart(2, '0')}</Text>
      <Text style={styles.countdownUnitLabel}>{unit}</Text>
    </View>
  )
}

function StatCard({ icon, value, label, onPress }: {
  icon: string; value: string | number; label: string; onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },

  countdownCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  countdownLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 16, textAlign: 'center' },
  groomName: { fontWeight: '700', color: '#fff' },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdownUnit: { alignItems: 'center' },
  countdownNumber: { fontSize: 40, fontWeight: '800', color: '#fff', lineHeight: 44 },
  countdownUnitLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  countdownSep: { fontSize: 32, fontWeight: '300', color: 'rgba(255,255,255,0.6)', marginBottom: 12 },

  codeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  codeLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 4 },
  codeValue: { fontSize: 26, fontWeight: '800', letterSpacing: 6, color: COLORS.text },
  shareButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: 16, paddingVertical: 8 },
  shareButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  eventTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  eventDate: { fontSize: 14, color: COLORS.muted, marginBottom: 4 },
  eventLocation: { fontSize: 14, color: COLORS.muted },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 15, color: COLORS.muted, marginBottom: 8 },
  emptyAction: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 18,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  quickIcon: { fontSize: 28, marginBottom: 8 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  importCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  importIcon: { fontSize: 28 },
  importTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  importDesc: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  importArrow: { fontSize: 24, color: COLORS.muted },
})
