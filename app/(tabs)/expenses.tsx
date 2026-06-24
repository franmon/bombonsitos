import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { calculateBalances, settleDebts } from '@/lib/settlement'
import { deleteExpense } from '@/lib/delete-helpers'
import { COLORS, RADIUS, EXPENSE_CATEGORIES } from '@/constants/theme'
import { Expense, Profile, DebtSummary } from '@/types/database'

interface ExpenseWithPayer extends Expense {
  payer: Profile
}

type Tab = 'list' | 'settle'

export default function ExpensesScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('list')
  const [expenses, setExpenses] = useState<ExpenseWithPayer[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadData() {
    if (!currentGroup) return

    const { data: expData } = await supabase
      .from('expenses')
      .select('*, payer:profiles!expenses_payer_fkey(*)')
      .eq('group_id', currentGroup.id)
      .order('created_at', { ascending: false })

    const { data: memberData } = await supabase
      .from('group_members')
      .select('profile:profiles(*)')
      .eq('group_id', currentGroup.id)

    setExpenses((expData as ExpenseWithPayer[]) ?? [])
    setMembers((memberData?.map((m: any) => m.profile) as Profile[]) ?? [])
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [currentGroup])

  useFocusEffect(useCallback(() => { loadData() }, [currentGroup]))

  async function handleDelete(id: string, title: string) {
    const deleted = await deleteExpense(id, title)
    if (deleted) loadData()
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const balances = calculateBalances(expenses, members)
  const settlements = settleDebts(balances)
  const myBalance = balances.find(b => b.userId === user?.id)

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Resumen superior */}
      <View style={styles.summary}>
        <Text style={styles.summaryTotal}>€{total.toFixed(2)}</Text>
        <Text style={styles.summaryLabel}>gastado en total</Text>
        {myBalance && (
          <View style={[
            styles.myBalancePill,
            myBalance.net >= 0 ? styles.balancePositive : styles.balanceNegative,
          ]}>
            <Text style={styles.myBalanceText}>
              {myBalance.net >= 0
                ? `Te deben €${myBalance.net.toFixed(2)}`
                : `Debes €${Math.abs(myBalance.net).toFixed(2)}`}
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'list' && styles.tabActive]}
          onPress={() => setTab('list')}
        >
          <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>Gastos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'settle' && styles.tabActive]}
          onPress={() => setTab('settle')}
        >
          <Text style={[styles.tabText, tab === 'settle' && styles.tabTextActive]}>Liquidación</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {tab === 'list' ? (
          expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💸</Text>
              <Text style={styles.emptyTitle}>Sin gastos aún</Text>
              <Text style={styles.emptyText}>Añade el primer gasto del viaje</Text>
            </View>
          ) : (
            expenses.map(exp => {
              const cat = EXPENSE_CATEGORIES[exp.category] ?? EXPENSE_CATEGORIES.general
              return (
                <TouchableOpacity
                  key={exp.id}
                  style={styles.expenseCard}
                  onLongPress={() => handleDelete(exp.id, exp.title)}
                  delayLongPress={400}
                >
                  <View style={[styles.catIcon, { backgroundColor: cat.color + '22' }]}>
                    <Text style={styles.catEmoji}>{cat.icon}</Text>
                  </View>
                  <View style={styles.expenseBody}>
                    <Text style={styles.expenseTitle}>{exp.title}</Text>
                    <Text style={styles.expenseMeta}>
                      Pagó {exp.payer?.name ?? '?'}
                      {exp.is_shared ? ' · compartido' : ' · individual'}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>€{exp.amount.toFixed(2)}</Text>
                </TouchableOpacity>
              )
            })
          )
        ) : (
          /* Liquidación */
          settlements.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyTitle}>Todo cuadrado</Text>
              <Text style={styles.emptyText}>No hay deudas pendientes entre vosotros</Text>
            </View>
          ) : (
            <>
              <Text style={styles.settleIntro}>
                La forma más simple de saldar las cuentas:
              </Text>
              {settlements.map((s, i) => (
                <View key={i} style={styles.settleRow}>
                  <Avatar name={s.fromProfile?.name} url={s.fromProfile?.avatar_url} size={36} />
                  <View style={styles.settleArrow}>
                    <Text style={styles.settleAmount}>€{s.amount.toFixed(2)}</Text>
                    <Text style={styles.settleArrowIcon}>→</Text>
                  </View>
                  <Avatar name={s.toProfile?.name} url={s.toProfile?.avatar_url} size={36} />
                  <Text style={styles.settleNames}>
                    {s.fromProfile?.name} paga a {s.toProfile?.name}
                  </Text>
                </View>
              ))}
            </>
          )
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/expense-new')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  summary: { alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  summaryTotal: { fontSize: 36, fontWeight: '800', color: COLORS.text },
  summaryLabel: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
  myBalancePill: {
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  balancePositive: { backgroundColor: '#DCFCE7' },
  balanceNegative: { backgroundColor: '#FEE2E2' },
  myBalanceText: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: 4, marginHorizontal: 20, marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.sm },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 15, fontWeight: '500', color: COLORS.muted },
  tabTextActive: { color: '#fff' },

  content: { padding: 20, paddingTop: 4, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 15, color: COLORS.muted, marginTop: 6, textAlign: 'center' },

  expenseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  catIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  catEmoji: { fontSize: 20 },
  expenseBody: { flex: 1, marginLeft: 12 },
  expenseTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  expenseMeta: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  expenseAmount: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  settleIntro: { fontSize: 14, color: COLORS.muted, marginBottom: 16 },
  settleRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border, flexWrap: 'wrap',
  },
  settleArrow: { alignItems: 'center', marginHorizontal: 12 },
  settleAmount: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  settleArrowIcon: { fontSize: 16, color: COLORS.muted },
  settleNames: { fontSize: 13, color: COLORS.muted, width: '100%', marginTop: 8 },

  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center',
    justifyContent: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 32, color: '#fff', fontWeight: '300', marginTop: -2 },
})
