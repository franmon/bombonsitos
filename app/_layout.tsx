import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { requestNotificationPermissions } from '@/lib/notifications'
import { COLORS } from '@/constants/theme'
import { View, ActivityIndicator } from 'react-native'

// Componente que gestiona las redirecciones según el estado de auth
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, profile } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  const onboarded = !!profile?.onboarding_complete

  // Pedir permiso de notificaciones cuando hay sesión
  useEffect(() => {
    if (session) {
      requestNotificationPermissions()
    }
  }, [session])

  useEffect(() => {
    if (loading) return
    // Si hay sesión pero el perfil aún no ha cargado, esperar (no decidir todavía)
    if (session && profile === undefined) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inGroupSetup = segments[0] === 'group-setup'
    const inOnboardingFlow = inAuthGroup || inOnboarding || inGroupSetup
    const enRaiz = segments[0] === undefined

    if (!session) {
      // Sin sesión → bienvenida (si no está ya en la zona de auth)
      if (!inAuthGroup) router.replace('/(auth)/welcome')
    } else if (!onboarded) {
      // Con sesión pero sin completar el alta → onboarding (si no está ya ahí)
      if (!inOnboardingFlow) router.replace('/onboarding/profile')
    } else if (session && onboarded && (inOnboardingFlow || enRaiz)) {
      // Logueado y con alta completa, pero en zona de alta o en la raíz
      // (al reabrir) → entrar a la app
      router.replace('/(tabs)')
    }
  }, [session, loading, onboarded, segments])

  // Mientras se decide (cargando o perfil aún en camino), mostrar spinner
  // en vez de dejar ver una pantalla incorrecta un instante
  const decidiendo = loading || (session && profile === undefined)
  if (decidiendo) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="group-setup" />
              <Stack.Screen name="event-new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="expense-new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="document-new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="polls" options={{ headerShown: true }} />
              <Stack.Screen name="poll-new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="timeline" options={{ headerShown: true }} />
              <Stack.Screen name="survey" options={{ headerShown: true }} />
              <Stack.Screen name="import-file" options={{ headerShown: true }} />
              <Stack.Screen name="collage" options={{ headerShown: true }} />
              <Stack.Screen name="dropbox-auth" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </NavigationGuard>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
