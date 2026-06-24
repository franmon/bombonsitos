import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { pickImage, uploadImage } from '@/lib/image-upload'
import { COLORS, RADIUS } from '@/constants/theme'

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [allergies, setAllergies] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '')
      setPhone(profile.phone ?? '')
      setAllergies(profile.allergies ?? '')
      setAvatarUrl(profile.avatar_url ?? null)
    }
  }, [profile])

  async function handleChangePhoto() {
    try {
      const asset = await pickImage()
      if (!asset) return

      setUploadingPhoto(true)
      const url = await uploadImage('avatars', user!.id, asset)

      // Guardar en el perfil inmediatamente
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
        allergies: allergies.trim() || null,
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

  function handleSignOut() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ])
  }

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

        <Text style={styles.label}>Alergias o restricciones</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={allergies}
          onChangeText={setAllergies}
          placeholder="Ej. intolerancia al gluten, vegetariano, alergia a frutos secos..."
          placeholderTextColor={COLORS.muted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <Text style={styles.hint}>
          Esto ayuda a organizar comidas y restaurantes para todos.
        </Text>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Guardar cambios</Text>
          }
        </TouchableOpacity>

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
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  avatarBadgeText: { fontSize: 14 },
  avatarHint: { fontSize: 13, color: COLORS.muted, marginTop: 10 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: { minHeight: 80, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.muted, marginBottom: 24 },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOutButton: { alignItems: 'center', marginTop: 18, padding: 12 },
  signOutText: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
})
