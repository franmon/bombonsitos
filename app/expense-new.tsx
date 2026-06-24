import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Switch, Platform, KeyboardAvoidingView,
} from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { COLORS, RADIUS, EXPENSE_CATEGORIES } from '@/constants/theme'
import { Profile, ExpenseCategory, ExpensePaidFrom } from '@/types/database'

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]

export default function NewExpenseScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('general')
  // Origen del pago: 'me' (yo) | 'partner' (mi pareja) | 'joint' (cuenta conjunta)
  const [paidFrom, setPaidFrom] = useState<ExpensePaidFrom>('me')
  const [isShared, setIsShared] = useState(true)
  const [members, setMembers] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentGroup) return
    supabase
      .from('group_members')
      .select('profile:profiles!group_members_profile_fkey(*)')
      .eq('group_id', currentGroup.id)
      .then(({ data }) => {
        const profiles = (data?.map((m: any) => m.profile) as Profile[]) ?? []
        setMembers(profiles)
      })
  }, [currentGroup])

  // La pareja (el otro miembro distinto de mí)
  const partner = members.find(m => m.id !== user?.id)

  async function handleSave() {
    const amountNum = parseFloat(amount.replace(',', '.'))
    if (!title.trim()) {
      Alert.alert('Falta el concepto', '¿En qué se gastó?')
      return
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Importe inválido', 'Pon una cantidad mayor que cero.')
      return
    }

    // Resolver quién pagó (paid_by) a partir del origen:
    //  - 'me'      → yo
    //  - 'partner' → el otro miembro
    //  - 'joint'   → lo registramos a mi nombre como "ejecutor", pero al ser
    //                cuenta conjunta no genera deuda (lo ignora la liquidación)
    let paidBy = user?.id ?? ''
    if (paidFrom === 'partner' && partner) paidBy = partner.id

    // Un gasto desde la cuenta conjunta no se reparte (ya es del bote común)
    const sharedFlag = paidFrom === 'joint' ? false : isShared

    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      group_id: currentGroup!.id,
      paid_by: paidBy,
      paid_from: paidFrom,
      title: title.trim(),
      amount: amountNum,
      is_shared: sharedFlag,
      split_with: null, // legacy: no se usa en pareja
      category,
    })

    setSaving(false)
    if (error) {
      Alert.alert('Error al guardar', error.message)
    } else {
      router.back()
    }
  }

  // Opciones del selector de origen del pago
  const PAID_OPTIONS: { key: ExpensePaidFrom; label: string; icon: string }[] = [
    { key: 'me', label: 'Yo', icon: '👤' },
    { key: 'partner', label: partner ? (partner.name?.split(' ')[0] ?? 'Mi pareja') : 'Mi pareja', icon: '💑' },
    { key: 'joint', label: 'Cuenta conjunta', icon: '🏦' },
  ]

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Nuevo gasto', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Concepto *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ej. Cena del viernes"
          placeholderTextColor={COLORS.muted}
        />

        <Text style={styles.label}>Importe *</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>€</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0,00"
            placeholderTextColor={COLORS.muted}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Categoría */}
        <Text style={styles.label}>Categoría</Text>
        <View style={styles.catGrid}>
          {CATEGORY_KEYS.map(key => {
            const cat = EXPENSE_CATEGORIES[key]
            const active = category === key
            return (
              <TouchableOpacity
                key={key}
                style={[styles.catChip, active && { backgroundColor: cat.color, borderColor: cat.color }]}
                onPress={() => setCategory(key)}
              >
                <Text style={styles.catChipEmoji}>{cat.icon}</Text>
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Origen del pago */}
        <Text style={styles.label}>¿Quién pagó?</Text>
        <View style={styles.paidRow}>
          {PAID_OPTIONS.map(opt => {
            const active = paidFrom === opt.key
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.paidChip, active && styles.paidChipActive]}
                onPress={() => setPaidFrom(opt.key)}
              >
                <Text style={styles.paidEmoji}>{opt.icon}</Text>
                <Text style={[styles.paidName, active && styles.paidNameActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Compartido vs personal — solo aplica si NO es cuenta conjunta */}
        {paidFrom !== 'joint' && (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Gasto compartido</Text>
              <Text style={styles.hint}>
                {isShared
                  ? 'Se reparte 50/50 entre los dos'
                  : 'Solo lo asume quien pagó'}
              </Text>
            </View>
            <Switch
              value={isShared}
              onValueChange={setIsShared}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
        )}

        {/* Aviso para cuenta conjunta */}
        {paidFrom === 'joint' && (
          <View style={styles.jointNote}>
            <Text style={styles.jointNoteText}>
              🏦 Pagado desde la cuenta conjunta. No genera deuda entre vosotros.
            </Text>
          </View>
        )}

        {/* Reparto informativo */}
        {paidFrom !== 'joint' && isShared && amount ? (
          <Text style={styles.splitHint}>
            €{(parseFloat(amount.replace(',', '.') || '0') / 2).toFixed(2)} cada uno
          </Text>
        ) : null}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Guardar gasto</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.muted },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    fontSize: 16, color: COLORS.text, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, paddingHorizontal: 16, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  currency: { fontSize: 24, fontWeight: '700', color: COLORS.muted, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '700', color: COLORS.text, paddingVertical: 14 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  catChipEmoji: { fontSize: 15 },
  catChipText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  catChipTextActive: { color: '#fff' },

  paidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  paidChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  paidChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  paidEmoji: { fontSize: 16 },
  paidName: { fontSize: 14, color: COLORS.muted, fontWeight: '500' },
  paidNameActive: { color: COLORS.primary, fontWeight: '700' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginVertical: 8,
  },
  jointNote: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    padding: 14, marginTop: 4,
  },
  jointNoteText: { fontSize: 13, color: COLORS.text },
  splitHint: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 12 },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
