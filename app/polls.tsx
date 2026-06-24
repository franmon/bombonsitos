import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter, useFocusEffect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { COLORS, RADIUS } from '@/constants/theme'
import { Poll, PollVote, PollOption } from '@/types/database'

interface PollWithVotes extends Poll {
  votes: PollVote[]
}

export default function PollsScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()
  const [polls, setPolls] = useState<PollWithVotes[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadPolls() {
    if (!currentGroup) return
    const { data } = await supabase
      .from('polls')
      .select('*, votes:poll_votes(*)')
      .eq('group_id', currentGroup.id)
      .order('created_at', { ascending: false })
    setPolls((data as PollWithVotes[]) ?? [])
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadPolls()
    setRefreshing(false)
  }, [currentGroup])

  useFocusEffect(useCallback(() => { loadPolls() }, [currentGroup]))

  async function vote(pollId: string, optionId: string) {
    if (!user) return
    await supabase
      .from('poll_votes')
      .upsert(
        { poll_id: pollId, user_id: user.id, option_id: optionId, voted_at: new Date().toISOString() },
        { onConflict: 'poll_id,user_id' }
      )
    loadPolls()
  }

  function myVote(poll: PollWithVotes): string | null {
    return poll.votes?.find(v => v.user_id === user?.id)?.option_id ?? null
  }

  function countVotes(poll: PollWithVotes, optionId: string): number {
    return poll.votes?.filter(v => v.option_id === optionId).length ?? 0
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Votaciones', headerShown: true }} />
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Votaciones', headerShown: true }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {polls.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🗳️</Text>
            <Text style={styles.emptyTitle}>Sin votaciones</Text>
            <Text style={styles.emptyText}>Crea una para decidir entre todos</Text>
          </View>
        ) : (
          polls.map(poll => {
            const mine = myVote(poll)
            const totalVotes = poll.votes?.length ?? 0
            return (
              <View key={poll.id} style={styles.pollCard}>
                <Text style={styles.pollQuestion}>{poll.question}</Text>
                {poll.options.map((opt: PollOption) => {
                  const count = countVotes(poll, opt.id)
                  const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0
                  const voted = mine === opt.id
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.optionRow}
                      onPress={() => vote(poll.id, opt.id)}
                    >
                      <View style={styles.optionBar}>
                        <View style={[styles.optionFill, { width: `${pct}%` }, voted && styles.optionFillVoted]} />
                        <View style={styles.optionContent}>
                          <Text style={[styles.optionText, voted && styles.optionTextVoted]}>
                            {voted ? '✓ ' : ''}{opt.text}
                          </Text>
                          <Text style={styles.optionCount}>{count}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )
                })}
                <Text style={styles.pollMeta}>
                  {totalVotes} voto{totalVotes === 1 ? '' : 's'}
                </Text>
              </View>
            )
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/poll-new')}>
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
  pollCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  pollQuestion: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  optionRow: { marginBottom: 8 },
  optionBar: {
    height: 44, borderRadius: RADIUS.sm, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', justifyContent: 'center',
  },
  optionFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: COLORS.primaryLight,
  },
  optionFillVoted: { backgroundColor: COLORS.primary + '40' },
  optionContent: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14,
  },
  optionText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  optionTextVoted: { fontWeight: '700', color: COLORS.primary },
  optionCount: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  pollMeta: { fontSize: 13, color: COLORS.muted, marginTop: 8 },
  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center',
    justifyContent: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 32, color: '#fff', fontWeight: '300', marginTop: -2 },
})
