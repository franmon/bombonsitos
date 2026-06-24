// ============================================================
// BACHELORAPP — Tipos TypeScript
// Auto-sincronizados con el esquema de Supabase
// ============================================================

export type UserRole = 'admin' | 'member'
export type RSVPStatus = 'yes' | 'no' | 'pending'
export type ExpenseCategory = 'food' | 'transport' | 'activity' | 'hotel' | 'general'
export type DocumentType = 'boarding_pass' | 'hotel' | 'ticket' | 'other'
// Origen del pago de un gasto en una pareja:
//  'me'      → lo pagó la persona actual (de su bolsillo)
//  'partner' → lo pagó la pareja (de su bolsillo)
//  'joint'   → pagado desde la cuenta conjunta (no genera deuda entre los dos)
export type ExpensePaidFrom = 'me' | 'partner' | 'joint'

// ── Grupo ────────────────────────────────────────────────────
export interface Group {
  id: string
  name: string
  code: string
  created_by: string
  groom_name: string | null
  groom_id: string | null
  is_discrete: boolean
  countdown_date: string | null
  created_at: string
}

// ── Perfil ───────────────────────────────────────────────────
export interface Profile {
  id: string
  name: string
  phone: string | null
  avatar_url: string | null
  allergies: string | null
  updated_at: string
  onboarding_complete: boolean
}

// ── Miembro del grupo ─────────────────────────────────────────
export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: UserRole
  joined_at: string
  profile?: Profile
}

// ── Evento / Actividad ────────────────────────────────────────
export interface Event {
  id: string
  group_id: string
  created_by: string
  title: string
  description: string | null
  location_name: string | null
  latitude: number | null
  longitude: number | null
  maps_url: string | null
  starts_at: string
  ends_at: string | null
  notify_before: number
  is_surprise: boolean
  created_at: string
  confirmations?: EventConfirmation[]
}

export interface EventConfirmation {
  id: string
  event_id: string
  user_id: string
  status: RSVPStatus
  updated_at: string
  profile?: Profile
}

// ── Gastos ────────────────────────────────────────────────────
export interface Expense {
  id: string
  group_id: string
  paid_by: string
  paid_from: ExpensePaidFrom   // me | partner | joint
  title: string
  amount: number
  is_shared: boolean
  split_with: string[] | null  // LEGACY: no usado en app de pareja (reparto 50/50)
  category: ExpenseCategory
  created_at: string
  payer?: Profile
}

export interface DebtSummary {
  from: string
  to: string
  amount: number
  fromProfile?: Profile
  toProfile?: Profile
}

// ── Fotos ─────────────────────────────────────────────────────
export interface Photo {
  id: string
  group_id: string
  uploaded_by: string
  storage_path: string
  thumbnail_path: string | null
  caption: string | null
  latitude: number | null
  longitude: number | null
  location_name: string | null
  taken_at: string
  is_capsule: boolean
  created_at: string
  uploader?: Profile
  url?: string
}

// ── Cápsula del tiempo ─────────────────────────────────────────
export interface TimeCapsule {
  id: string
  group_id: string
  is_locked: boolean
  unlocked_at: string | null
  created_at: string
  photos?: Photo[]
}

// ── Documentos de viaje ───────────────────────────────────────
export interface TravelDocument {
  id: string
  group_id: string
  uploaded_by: string
  type: DocumentType
  title: string
  storage_path: string
  flight_number: string | null
  departure_at: string | null
  arrival_at: string | null
  departure_airport: string | null
  arrival_airport: string | null
  hotel_name: string | null
  checkin_date: string | null
  checkout_date: string | null
  address: string | null
  wifi_password: string | null
  safe_code: string | null
  created_at: string
}

// ── Votaciones ────────────────────────────────────────────────
export interface PollOption {
  id: string
  text: string
}

export interface Poll {
  id: string
  group_id: string
  created_by: string
  question: string
  options: PollOption[]
  is_open: boolean
  created_at: string
  votes?: PollVote[]
}

export interface PollVote {
  id: string
  poll_id: string
  user_id: string
  option_id: string
  voted_at: string
}

// ── Encuesta post-viaje ───────────────────────────────────────
export interface TripSurvey {
  id: string
  group_id: string
  user_id: string
  overall: number
  highlights: string | null
  suggestions: string | null
  submitted_at: string
}

// ── Helpers ──────────────────────────────────────────────────
export interface AppState {
  user: import('@supabase/supabase-js').User | null
  profile: Profile | null
  currentGroup: Group | null
  isAdmin: boolean
  isDiscrete: boolean
}
