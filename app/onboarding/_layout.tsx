import { Stack } from 'expo-router'

// Stack del onboarding (sin cabeceras; cada pantalla dibuja la suya).
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="profile" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="invite" />
    </Stack>
  )
}
