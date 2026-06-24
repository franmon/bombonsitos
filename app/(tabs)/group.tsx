import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Switch, RefreshControl,
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
  const { user, currentGroup, isAdmin, setCurrentGroup } = useAuth()
  const router = useRouter()
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [isDiscrete, setIsDiscrete] = useState(currentGroup?.is_discrete ?? false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadMembers() {
    if (!currentGroup) return

    const { data, error } = await supabase
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
    setIsDiscrete(currentGroup?.is_discrete ?? false)
  }, [currentGroup])

  async function toggleDiscrete(value: boolean) {
    if (!currentGroup) return
    setIsDiscrete(value)

    const { error } = await supabase
      .from('groups')
      .update({ is_discrete: value })
      .eq('id', currentGroup.id)

    if (error) {
      setIsDiscrete(!value) // revertir
      Alert.alert('Error', 'No se pudo cambiar el modo discreción.')
    } else {
      setCurrentGroup({ ...currentGroup, is_discrete: value })
    }
  }

  async function shareCode() {
    if (!currentGroup) return
    await Share.share({
      message: `¡Únete a "${currentGroup.name}"! 🎉\nCódigo: ${currentGroup.code}`,
    })
  }

  function leaveGroup() {
    Alert.alert(
      'Cambiar de grupo',
      '¿Quieres salir de este grupo? Podrás volver a unirte con el código.',
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Cabecera del grupo */}
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{currentGroup?.name}</Text>
        {currentGroup?.groom_name && (
          <Text style={styles.groupGroom}>Despedida de {currentGroup.groom_name}</Text>
        )}
        <TouchableOpacity style={styles.codePill} onPress={shareCode}>
          <Text style={styles.codePillText}>Código: {currentGroup?.code}</Text>
          <Text style={styles.codePillShare}>Compartir ›</Text>
        </TouchableOpacity>
      </View>

      {/* Modo discreción (solo admin) */}
      {isAdmin && (
        <View style={styles.discreteCard}>
          <View style={styles.discreteHeader}>
            <Text style={styles.discreteTitle}>🤫 Modo discreción</Text>
            <Switch
              value={isDiscrete}
              onValueChange={toggleDiscrete}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.discreteDesc}>
            Cuando está activo, las actividades marcadas como sorpresa se ocultan
            para que el novio no las vea si está en el grupo.
          </Text>
        </View>
      )}

      {/* Lista de miembros */}
      <Text style={styles.sectionTitle}>
        Miembros ({members.length})
      </Text>

      {members.map(member => (
        <View key={member.id} style={styles.memberRow}>
          <Avatar name={member.profile?.name} url={member.profile?.avatar_url} size={48} />
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName}>
                {member.profile?.name}
                {member.user_id === user?.id && ' (tú)'}
              </Text>
              {member.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Organizador</Text>
                </View>
              )}
            </View>
            {member.profile?.phone && (
              <Text style={styles.memberDetail}>📞 {member.profile.phone}</Text>
            )}
            {member.profile?.allergies && (
              <Text style={styles.memberAllergies}>⚠️ {member.profile.allergies}</Text>
            )}
          </View>
        </View>
      ))}

      {/* Acciones */}
      <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile')}>
        <Text style={styles.profileButtonText}>Editar mi perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.leaveButton} onPress={leaveGroup}>
        <Text style={styles.leaveButtonText}>Salir del grupo</Text>
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
  groupGroom: { fontSize: 15, color: COLORS.muted, marginTop: 4 },
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

  discreteCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  discreteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discreteTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  discreteDesc: { fontSize: 13, color: COLORS.muted, marginTop: 8, lineHeight: 19 },

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
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  adminBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  memberDetail: { fontSize: 13, color: COLORS.muted, marginTop: 3 },
  memberAllergies: { fontSize: 13, color: COLORS.warning, marginTop: 3 },

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
