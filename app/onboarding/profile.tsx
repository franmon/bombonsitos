import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { pickImage, uploadImage } from '@/lib/image-upload'
import { COLORS, RADIUS } from '@/constants/theme'

// Tu perfil — foto + nombre para mostrar. Paso 2 del alta.
export default function ProfileSetupScreen() {
  const router = useRouter()
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  function initials() {
    const p = (name || '?').trim().split(' ').filter(Boolean)
    return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase()
  }

  async function handlePickAvatar() {
    if (!user) return
    try {
      const asset = await pickImage()
      if (!asset) return
      setUploading(true)
      const url = await uploadImage('avatars', user.id, asset)
      setAvatarUrl(url)
    } catch (e: any) {
      Alert.alert('No se pudo subir la foto', e.message ?? 'Inténtalo de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleContinue() {
    if (!user) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ name: name.trim() || null, avatar_url: avatarUrl })
      .eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    router.push('/group-setup')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Añade tu perfil</Text>
        <Text style={styles.subtitle}>Así tus amigos te reconocen en el grupo.</Text>

        <View style={styles.avatarWrap}>
          <TouchableOpacity style={styles.avatar} onPress={handlePickAvatar} activeOpacity={0.8}>
            {uploading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitials}>{initials()}</Text>
            )}
            <View style={styles.avatarBadge}><Text style={styles.avatarBadgeIcon}>📷</Text></View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Toca para añadir una foto</Text>
        </View>

        <Text style={styles.label}>Nombre para mostrar</Text>
        <TextInput
          style={styles.input}
          placeholder="Cómo te llaman tus amigos"
          placeholderTextColor={COLORS.muted}
          value={name}
          onChangeText={setName}
        />

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continuar</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.skip} onPress={() => router.push('/group-setup')}>
          <Text style={styles.skipText}>Lo haré luego</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  //inner: { padding: 28, paddingTop: 60, flexGrow: 1 },  
  inner: { padding: 28, paddingTop: 60, paddingBottom: 60, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.muted, marginTop: 6, marginBottom: 24 },
  avatarWrap: { alignItems: 'center', gap: 12, marginBottom: 24 },
  avatar: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.accent,
  },
  avatarImg: { width: 112, height: 112, borderRadius: 56 },
  avatarInitials: { fontSize: 38, fontWeight: '800', color: COLORS.primary },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  avatarBadgeIcon: { fontSize: 15 },
  avatarHint: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 7 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 15, fontSize: 15,
    color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border,
  },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { alignItems: 'center', marginTop: 20, padding: 6 },
  skipText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  signOut: { alignItems: 'center', marginTop: 4, padding: 6 },
  signOutText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
})
