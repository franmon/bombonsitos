// ============================================================
// BACHELORAPP / DespedidaJordan — Design Tokens
// Reskin azul + naranja. Mantiene las MISMAS claves que tu
// theme.ts actual, así que todas las pantallas existentes
// (login, group-setup, tabs…) se re-tematizan automáticamente.
// ============================================================

export const COLORS = {
  // Marca
  primary: '#2563EB',        // Azul principal  (antes violeta #6C63FF)
  primaryLight: '#EAF1FF',   // Azul claro (fondos de pills, etc.)
  accent: '#F4612A',         // Naranja acento  (antes rosa #FF6584)
  accentLight: '#FFF1E9',    // Naranja claro (fondos suaves)

  // Semánticos
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Neutros
  text: '#14213D',
  muted: '#6B7280',
  border: '#E6E9EF',
  surface: '#F6F8FB',
  background: '#FFFFFF',

  // Categorías de gastos
  categoryFood: '#F59E0B',
  categoryTransport: '#3B82F6',
  categoryActivity: '#2563EB',   // antes violeta → ahora azul
  categoryHotel: '#22C55E',
  categoryGeneral: '#6B7280',
}

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  full: 9999,
}

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
}

export const FONTS = {
  regular: { fontWeight: '400' as const },
  medium: { fontWeight: '500' as const },
  semibold: { fontWeight: '600' as const },
  bold: { fontWeight: '700' as const },
  extrabold: { fontWeight: '800' as const },
}

// Categorías de gastos con color e icono
export const EXPENSE_CATEGORIES = {
  food: { label: 'Comida', icon: '🍽️', color: COLORS.categoryFood },
  transport: { label: 'Transporte', icon: '🚗', color: COLORS.categoryTransport },
  activity: { label: 'Actividad', icon: '🎯', color: COLORS.categoryActivity },
  hotel: { label: 'Alojamiento', icon: '🏨', color: COLORS.categoryHotel },
  general: { label: 'General', icon: '📦', color: COLORS.categoryGeneral },
} as const

// Tipos de documento
export const DOCUMENT_TYPES = {
  boarding_pass: { label: 'Tarjeta de embarque', icon: '✈️' },
  hotel: { label: 'Hotel / Alojamiento', icon: '🏨' },
  ticket: { label: 'Entrada / Bono', icon: '🎟️' },
  other: { label: 'Otro documento', icon: '📄' },
} as const
