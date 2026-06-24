import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { pickImage, uploadImage } from '@/lib/image-upload'
import { connectDropbox, getDropboxConnection, disconnectDropbox } from '@/lib/dropbox'
import { COLORS, RADIUS } from '@/constants/theme'

export default function ProfileScreen() {
  const { user, currentGroup, profile, refreshProfile, signOut } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Estado de Dropbox
  const [dropbox, setDropbox] = useState<{ account_email: string | null; status: string; last_backup_at: string | null } | null>(null)
  const [dropboxBusy, setDropboxBusy] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '')
      setPhone(profile.phone ?? '')
      setAvatarUrl(profile.avatar_url ?? null)
    }
  }, [profile])

  const loadDropbox = useCallback(async () => {
    if (!currentGroup) return
    const conn = await getDropboxConnection(currentGroup.id)
    setDropbox(conn as any)
  }, [currentGroup])

  useFocusEffect(useCallback(() => { loadDropbox() }, [loadDropbox]))

  async function handleChangePhoto() {
    try {
      const asset = await pickImage()
      if (!asset) return
      setUploadingPhoto(true)
      const url = await uploadImage('avatars', user!.id, asset)
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user!.id)
      setAvatarUrl(url)
      await refreshProfile()
    } catch (e: any) {
      Alert.alert('Error con la foto', e.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Necesitas un nombre.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user!.id)

    setSaving(false)
    if (error) {
      Alert.alert('Error al guardar', error.message)
    } else {
      await refreshProfile()
      Alert.alert('Guardado ✓', 'Tu perfil se ha actualizado.')
    }
  }

  async function handleConnectDropbox() {
    if (!currentGroup) return
    setDropboxBusy(true)
    const res = await connectDropbox(currentGroup.id)
    setDropboxBusy(false)
    if (res.ok) {
      Alert.alert('Dropbox conectado ✓', res.accountEmail ? `Cuenta: ${res.accountEmail}` : 'Conexión lista.')
      loadDropbox()
    } else {
      Alert.alert('No se pudo conectar', res.error ?? 'Inténtalo de nuevo.')
    }
  }

  function handleDisconnectDropbox() {
    if (!currentGroup) return
    Alert.alert('Desconectar Dropbox', '¿Seguro? Dejará de hacer copias de seguridad.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          await disconnectDropbox(currentGroup.id)
          loadDropbox()
        },
      },
    ])
  }

  function handleSignOut() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ])
  }

  const isConnected = dropbox?.status === 'connected'

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
            <Avatar name={name} url={avatarUrl} size={100} />
            <View style={styles.avatarBadge}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.avatarBadgeText}>📷</Text>
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Toca para cambiar la foto</Text>
        </View>

        {/* Formulario */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          placeholderTextColor={COLORS.muted}
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+34 600 000 000"
          placeholderTextColor={COLORS.muted}
          keyboardType="phone-pad"
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Guardar cambios</Text>
          }
        </TouchableOpacity>

        {/* Sección Dropbox */}
        <Text style={styles.sectionTitle}>Copia de seguridad de fotos</Text>
        <View style={styles.dropboxCard}>
          <View style={styles.dropboxHeader}>
            <Text style={styles.dropboxIcon}>🗂️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.dropboxTitle}>Dropbox</Text>
              <Text style={styles.dropboxStatus}>
                {isConnected
                  ? `Conectado${dropbox?.account_email ? ` · ${dropbox.account_email}` : ''}`
                  : 'No conectado'}
              </Text>
            </View>
          </View>

          {isConnected ? (
            <TouchableOpacity style={styles.dropboxDisconnect} onPress={handleDisconnectDropbox}>
              <Text style={styles.dropboxDisconnectText}>Desconectar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.dropboxConnect} onPress={handleConnectDropbox} disabled={dropboxBusy}>
              {dropboxBusy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.dropboxConnectText}>Conectar Dropbox</Text>
              }
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.hint}>
          Conecta Dropbox para guardar una copia de vuestras fotos.
        </Text>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.background,
  },
  avatarBadgeText: { fontSize: 14 },
  avatarHint: { fontSize: 13, color: COLORS.muted, marginTop: 10 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    fontSize: 16, color: COLORS.text, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  hint: { fontSize: 12, color: COLORS.muted, marginBottom: 24, marginTop: 8 },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 32, marginBottom: 12 },
  dropboxCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dropboxHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  dropboxIcon: { fontSize: 28 },
  dropboxTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  dropboxStatus: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  dropboxConnect: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 13, alignItems: 'center',
  },
  dropboxConnectText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dropboxDisconnect: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 13, alignItems: 'center',
  },
  dropboxDisconnectText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },

  signOutButton: { alignItems: 'center', marginTop: 18, padding: 12 },
  signOutText: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
})
