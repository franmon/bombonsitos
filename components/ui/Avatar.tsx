import { View, Text, Image, StyleSheet } from 'react-native'
import { COLORS } from '@/constants/theme'

interface AvatarProps {
  name?: string | null
  url?: string | null
  size?: number
  showBorder?: boolean
}

// Genera un color consistente a partir del nombre
function colorFromName(name: string): string {
  const colors = ['#6C63FF', '#FF6584', '#22C55E', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6']
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, url, size = 48, showBorder = false }: AvatarProps) {
  const displayName = name || '?'
  const bgColor = colorFromName(displayName)
  const fontSize = size * 0.4

  const borderStyle = showBorder
    ? { borderWidth: 2, borderColor: COLORS.background }
    : {}

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          borderStyle,
        ]}
      />
    )
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
        borderStyle,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials(displayName)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '700' },
})
