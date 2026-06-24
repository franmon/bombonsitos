import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '@/constants/theme'

// Pantalla de retorno del OAuth de Dropbox.
// Dropbox redirige a bombonsitos://dropbox-auth?code=...
// Esta pantalla existe para que Expo Router reconozca la ruta (en vez de
// mostrar "Unmatched Route"). El código lo captura el listener de Linking
// en lib/dropbox.ts; aquí solo cerramos y volvemos al perfil.
export default function DropboxAuthReturn() {
  const router = useRouter()

  useEffect(() => {
    // Dar un instante a que el listener capture el código, luego volver.
    const t = setTimeout(() => {
      router.replace('/(tabs)/profile')
    }, 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
})
