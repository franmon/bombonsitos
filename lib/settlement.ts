import { Expense, Profile, DebtSummary } from '@/types/database'

// Resultado del cálculo de balances
export interface Balance {
  userId: string
  profile?: Profile
  paid: number      // cuánto ha pagado de su bolsillo (sin contar la cuenta conjunta)
  owes: number      // cuánto le corresponde pagar (su parte)
  net: number       // paid - owes (positivo = le deben, negativo = debe)
}

// Calcula cuánto ha pagado y cuánto debe cada persona.
// IMPORTANTE: los gastos pagados desde la cuenta conjunta ('joint') NO entran
// aquí, porque ya están pagados del bote común y no generan deuda entre los dos.
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
    // Los gastos de la cuenta conjunta no afectan al saldo entre las personas
    if (exp.paid_from === 'joint') continue

    // Quién paga
    if (balances[exp.paid_by]) {
      balances[exp.paid_by].paid += exp.amount
    }

    if (exp.is_shared) {
      // Gasto compartido entre 2: reparto 50/50 entre todos los miembros
      const share = exp.amount / members.length
      for (const m of members) {
        if (balances[m.id]) balances[m.id].owes += share
      }
    } else {
      // Gasto personal: solo lo asume quien lo pagó (no afecta al otro)
      if (balances[exp.paid_by]) balances[exp.paid_by].owes += exp.amount
    }
  }

  // Calcular el neto de cada uno
  for (const uid in balances) {
    balances[uid].net = balances[uid].paid - balances[uid].owes
  }

  return Object.values(balances)
}

// Total gastado desde la cuenta conjunta (para mostrarlo aparte en el resumen)
export function jointTotal(expenses: Expense[]): number {
  return expenses
    .filter(e => e.paid_from === 'joint')
    .reduce((sum, e) => sum + e.amount, 0)
}

// Algoritmo de liquidación: minimiza el número de transferencias.
// Con una pareja (2 personas) se reduce a una sola transferencia.
// Devuelve la lista de "X paga Y€ a Z".
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
