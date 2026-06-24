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
import { Profile, ExpenseCategory } from '@/types/database'

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]

export default function NewExpenseScreen() {
  const { user, currentGroup } = useAuth()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('general')
  const [paidBy, setPaidBy] = useState(user?.id ?? '')
  const [isShared, setIsShared] = useState(true)
  const [splitWith, setSplitWith] = useState<string[]>([])
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
        // Por defecto, dividir entre todos
        setSplitWith(profiles.map(p => p.id))
      })
  }, [currentGroup])

  function toggleSplitMember(id: string) {
    setSplitWith(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

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
    if (isShared && splitWith.length === 0) {
      Alert.alert('¿Entre quién?', 'Selecciona al menos una persona para dividir.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      group_id: currentGroup!.id,
      paid_by: paidBy,
      title: title.trim(),
      amount: amountNum,
      is_shared: isShared,
      split_with: isShared ? splitWith : null,
      category,
    })

    setSaving(false)
    if (error) {
      Alert.alert('Error al guardar', error.message)
    } else {
      router.back()
    }
  }

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

        {/* Quién paga */}
        <Text style={styles.label}>¿Quién pagó?</Text>
        <View style={styles.payerRow}>
          {members.map(m => {
            const active = paidBy === m.id
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.payerChip, active && styles.payerChipActive]}
                onPress={() => setPaidBy(m.id)}
              >
                <Avatar name={m.name} url={m.avatar_url} size={28} />
                <Text style={[styles.payerName, active && styles.payerNameActive]}>
                  {m.id === user?.id ? 'Yo' : m.name?.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Compartido vs individual */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Gasto compartido</Text>
            <Text style={styles.hint}>
              {isShared ? 'Se divide entre los seleccionados' : 'Solo lo asume quien pagó'}
            </Text>
          </View>
          <Switch
            value={isShared}
            onValueChange={setIsShared}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* División */}
        {isShared && (
          <>
            <Text style={styles.label}>Dividir entre</Text>
            <View style={styles.splitList}>
              {members.map(m => {
                const checked = splitWith.includes(m.id)
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.splitRow}
                    onPress={() => toggleSplitMember(m.id)}
                  >
                    <Avatar name={m.name} url={m.avatar_url} size={32} />
                    <Text style={styles.splitName}>
                      {m.id === user?.id ? 'Yo' : m.name}
                    </Text>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
            {splitWith.length > 0 && amount ? (
              <Text style={styles.splitHint}>
                €{(parseFloat(amount.replace(',', '.') || '0') / splitWith.length).toFixed(2)} por persona
              </Text>
            ) : null}
          </>
        )}

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
  payerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  payerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  payerChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  payerName: { fontSize: 14, color: COLORS.muted, fontWeight: '500' },
  payerNameActive: { color: COLORS.primary, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginVertical: 8,
  },
  splitList: { marginTop: 4 },
  splitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  splitName: { flex: 1, fontSize: 15, color: COLORS.text },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  splitHint: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 12 },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 28,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
