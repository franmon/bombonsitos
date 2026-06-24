import { Expense, Profile, DebtSummary } from '@/types/database'

// Resultado del cálculo de balances
export interface Balance {
  userId: string
  profile?: Profile
  paid: number      // cuánto ha pagado en total
  owes: number      // cuánto le corresponde pagar (su parte)
  net: number       // paid - owes (positivo = le deben, negativo = debe)
}

// Calcula cuánto ha pagado y cuánto debe cada persona
export function calculateBalances(
  expenses: Expense[],
  members: Profile[]
): Balance[] {
  const balances: Record<string, Balance> = {}

  // Inicializar todos los miembros a cero
  for (const m of members) {
    balances[m.id] = { userId: m.id, profile: m, paid: 0, owes: 0, net: 0 }
  }

  for (const exp of expenses) {
    // Quién paga
    if (balances[exp.paid_by]) {
      balances[exp.paid_by].paid += exp.amount
    }

    if (exp.is_shared) {
      // Gasto compartido: se divide entre split_with (o entre todos si es null)
      const sharers = exp.split_with && exp.split_with.length > 0
        ? exp.split_with
        : members.map(m => m.id)

      const share = exp.amount / sharers.length
      for (const uid of sharers) {
        if (balances[uid]) balances[uid].owes += share
      }
    } else {
      // Gasto individual: solo lo asume quien lo pagó (no afecta a otros)
      if (balances[exp.paid_by]) balances[exp.paid_by].owes += exp.amount
    }
  }

  // Calcular el neto de cada uno
  for (const uid in balances) {
    balances[uid].net = balances[uid].paid - balances[uid].owes
  }

  return Object.values(balances)
}

// Algoritmo de liquidación: minimiza el número de transferencias
// Devuelve la lista de "X paga Y€ a Z"
export function settleDebts(balances: Balance[]): DebtSummary[] {
  const EPSILON = 0.01

  // Separar acreedores (net > 0) y deudores (net < 0)
  const creditors = balances
    .filter(b => b.net > EPSILON)
    .map(b => ({ ...b }))
    .sort((a, b) => b.net - a.net)

  const debtors = balances
    .filter(b => b.net < -EPSILON)
    .map(b => ({ ...b, net: -b.net })) // convertir a positivo (lo que debe)
    .sort((a, b) => b.net - a.net)

  const settlements: DebtSummary[] = []
  let i = 0 // índice de deudores
  let j = 0 // índice de acreedores

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]

    const amount = Math.min(debtor.net, creditor.net)

    if (amount > EPSILON) {
      settlements.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(amount * 100) / 100,
        fromProfile: debtor.profile,
        toProfile: creditor.profile,
      })
    }

    debtor.net -= amount
    creditor.net -= amount

    if (debtor.net < EPSILON) i++
    if (creditor.net < EPSILON) j++
  }

  return settlements
}
