import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl,
  Share, ActivityIndicator,
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { COLORS, RADIUS } from '@/constants/theme'
import { GroupMember, Profile } from '@/types/database'

interface MemberWithProfile extends GroupMember {
  profile: Profile
}

export default function GroupScreen() {
  const { user, currentGroup, setCurrentGroup } = useAuth()
  const router = useRouter()
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadMembers() {
    if (!currentGroup) return

    const { data } = await supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_profile_fkey(*)')
      .eq('group_id', currentGroup.id)
      .order('joined_at', { ascending: true })

    setMembers((data as MemberWithProfile[]) ?? [])
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadMembers()
    setRefreshing(false)
  }, [currentGroup])

  useEffect(() => {
    loadMembers()
  }, [currentGroup])

  async function shareCode() {
    if (!currentGroup) return
    await Share.share({
      message: `¡Únete a "${currentGroup.name}"! 💑\nCódigo: ${currentGroup.code}`,
    })
  }

  function leaveGroup() {
    Alert.alert(
      'Salir',
      '¿Quieres salir? Podrás volver a unirte con el código.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('group_members')
              .delete()
              .eq('group_id', currentGroup!.id)
              .eq('user_id', user!.id)
            setCurrentGroup(null)
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  // ¿Falta que se una la pareja? (solo 1 miembro de momento)
  const waitingForPartner = members.length < 2

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Cabecera */}
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{currentGroup?.name}</Text>
        <TouchableOpacity style={styles.codePill} onPress={shareCode}>
          <Text style={styles.codePillText}>Código: {currentGroup?.code}</Text>
          <Text style={styles.codePillShare}>Compartir ›</Text>
        </TouchableOpacity>
      </View>

      {/* Aviso si la pareja aún no se ha unido */}
      {waitingForPartner && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingTitle}>💌 Invita a tu pareja</Text>
          <Text style={styles.waitingDesc}>
            Comparte el código de arriba para que se una y empecéis a compartir cosas.
          </Text>
        </View>
      )}

      {/* Vosotros */}
      <Text style={styles.sectionTitle}>Vosotros</Text>

      {members.map(member => (
        <View key={member.id} style={styles.memberRow}>
          <Avatar name={member.profile?.name} url={member.profile?.avatar_url} size={48} />
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>
              {member.profile?.name}
              {member.user_id === user?.id && ' (tú)'}
            </Text>
            {member.profile?.phone && (
              <Text style={styles.memberDetail}>📞 {member.profile.phone}</Text>
            )}
          </View>
        </View>
      ))}

      {/* Acciones */}
      <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile')}>
        <Text style={styles.profileButtonText}>Editar mi perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.leaveButton} onPress={leaveGroup}>
        <Text style={styles.leaveButtonText}>Salir</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },

  groupHeader: { alignItems: 'center', marginBottom: 24 },
  groupName: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  codePillText: { fontSize: 14, fontWeight: '700', color: COLORS.primary, letterSpacing: 1 },
  codePillShare: { fontSize: 13, color: COLORS.primary },

  waitingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  waitingTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  waitingDesc: { fontSize: 13, color: COLORS.muted, marginTop: 8, lineHeight: 19 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 14 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  memberDetail: { fontSize: 13, color: COLORS.muted, marginTop: 3 },

  profileButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  profileButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  leaveButton: { alignItems: 'center', marginTop: 16, padding: 12 },
  leaveButtonText: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
})
