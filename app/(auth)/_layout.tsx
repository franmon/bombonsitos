import { Stack } from 'expo-router'

// Layout del grupo de autenticación: bienvenida, login y registro.
// Sin cabecera; cada pantalla gestiona su propio diseño.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
