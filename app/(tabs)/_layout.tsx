import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '@/constants/theme'

import { SafeAreaProvider } from 'react-native-safe-area-context'

type IoniconName = keyof typeof Ionicons.glyphMap

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />
}

export default function TabsLayout() {

  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 0),        
        },
        headerStyle: { backgroundColor: COLORS.background },
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: COLORS.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} />,
          headerTitle: '🎉 Despedida',
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <TabIcon name="calendar-outline" color={color} size={size} />,
          headerTitle: '📅 Agenda',
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Gastos',
          tabBarIcon: ({ color, size }) => <TabIcon name="wallet-outline" color={color} size={size} />,
          headerTitle: '💸 Gastos',
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: 'Fotos',
          tabBarIcon: ({ color, size }) => <TabIcon name="images-outline" color={color} size={size} />,
          headerTitle: '📸 Fotos',
        }}
      />
      <Tabs.Screen
        name="travel"
        options={{
          title: 'Viaje',
          tabBarIcon: ({ color, size }) => <TabIcon name="airplane-outline" color={color} size={size} />,
          headerTitle: '✈️ Viaje',
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: 'Grupo',
          tabBarIcon: ({ color, size }) => <TabIcon name="people-outline" color={color} size={size} />,
          headerTitle: '👥 Grupo',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <TabIcon name="person-outline" color={color} size={size} />,
          headerTitle: 'Mi perfil',
          headerShown: true,
        }}
      />
    </Tabs>
  )
}
