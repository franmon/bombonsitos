import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { calculateBalances, settleDebts, jointTotal } from '@/lib/settlement'
import { deleteExpense } from '@/lib/delete-helpers'
import { COLORS, RADIUS, EXPENSE_CATEGORIES } from '@/constants/theme'
import { Expense, Profile } from '@/types/database'

interface ExpenseWithPayer extends Expense {
  payer: Profile
}

export default function ExpensesScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()
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
      .select('profile:profiles!group_members_profile_fkey(*)')
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
  const joint = jointTotal(expenses)
  const balances = calculateBalances(expenses, members)
  const settlements = settleDebts(balances)
  // Con 2 personas hay como mucho una transferencia pendiente
  const settlement = settlements[0]

  // Texto del saldo entre la pareja
  let balanceText = 'Estáis en paz 🤝'
  let balancePositive = true
  if (settlement) {
    const iOwe = settlement.from === user?.id
    if (iOwe) {
      balanceText = `Le debes €${settlement.amount.toFixed(2)} a ${settlement.toProfile?.name?.split(' ')[0] ?? 'tu pareja'}`
      balancePositive = false
    } else {
      balanceText = `Te debe €${settlement.amount.toFixed(2)} ${settlement.fromProfile?.name?.split(' ')[0] ?? 'tu pareja'}`
      balancePositive = true
    }
  }

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

        {joint > 0 && (
          <Text style={styles.jointLine}>🏦 De la cuenta conjunta: €{joint.toFixed(2)}</Text>
        )}

        <View style={[
          styles.balancePill,
          balancePositive ? styles.balanceOk : styles.balanceDebt,
        ]}>
          <Text style={styles.balanceText}>{balanceText}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>Sin gastos aún</Text>
            <Text style={styles.emptyText}>Añade vuestro primer gasto</Text>
          </View>
        ) : (
          expenses.map(exp => {
            const cat = EXPENSE_CATEGORIES[exp.category] ?? EXPENSE_CATEGORIES.general
            // Etiqueta de origen
            let tag = '🤝 compartido'
            if (exp.paid_from === 'joint') tag = '🏦 cuenta conjunta'
            else if (!exp.is_shared) tag = '👤 personal'

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
                    {exp.paid_from === 'joint'
                      ? 'Cuenta conjunta'
                      : `Pagó ${exp.payer?.id === user?.id ? 'tú' : (exp.payer?.name?.split(' ')[0] ?? '?')}`}
                    {' · '}{tag}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>€{exp.amount.toFixed(2)}</Text>
              </TouchableOpacity>
            )
          })
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
  jointLine: { fontSize: 13, color: COLORS.muted, marginTop: 6 },
  balancePill: {
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full,
  },
  balanceOk: { backgroundColor: '#DCFCE7' },
  balanceDebt: { backgroundColor: '#FEE2E2' },
  balanceText: { fontSize: 14, fontWeight: '600', color: COLORS.text },

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

  fab: {
    position: 'absolute', right: 24, bottom: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center',
    justifyContent: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 32, color: '#fff', fontWeight: '300', marginTop: -2 },
})
