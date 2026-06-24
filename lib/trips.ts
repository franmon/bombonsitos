import { supabase } from './supabase'
import { runBackup } from './dropbox'

export interface Trip {
  id: string
  group_id: string
  created_by: string
  name: string
  started_at: string
  ended_at: string | null
  backed_up_at: string | null
  photo_count: number
  created_at: string
}

// Devuelve el viaje abierto de la pareja (ended_at IS NULL), o null si no hay.
export async function getOpenTrip(groupId: string): Promise<Trip | null> {
  const { data } = await supabase
    .from('trips')
    .select('*')
    .eq('group_id', groupId)
    .is('ended_at', null)
    .maybeSingle()
  return (data as Trip) ?? null
}

// Historial de viajes cerrados, más recientes primero.
export async function listTrips(groupId: string): Promise<Trip[]> {
  const { data } = await supabase
    .from('trips')
    .select('*')
    .eq('group_id', groupId)
    .order('started_at', { ascending: false })
  return (data as Trip[]) ?? []
}

// Empieza un viaje nuevo. Falla si ya hay uno abierto (índice único en BD).
export async function startTrip(groupId: string, userId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('trips').insert({
    group_id: groupId,
    created_by: userId,
    name: name.trim() || 'Viaje',
    started_at: new Date().toISOString(),
  })
  if (error) {
    // 23505 = violación de índice único (ya hay un viaje abierto)
    if (error.code === '23505') {
      return { ok: false, error: 'Ya tenéis un viaje abierto. Ciérralo antes de empezar otro.' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export interface CloseTripResult {
  ok: boolean
  uploaded?: number
  error?: string
}

// Cierra el viaje y respalda a Dropbox las fotos tomadas en su rango.
// Las fotos "del viaje" son las que tienen taken_at entre started_at y el cierre.
export async function closeTripAndBackup(trip: Trip, dropboxConnected: boolean): Promise<CloseTripResult> {
  const endedAt = new Date().toISOString()

  // 1. Buscar las fotos del rango del viaje (no de cápsula)
  const { data: photos, error: photosErr } = await supabase
    .from('photos')
    .select('id')
    .eq('group_id', trip.group_id)
    .eq('is_capsule', false)
    .gte('taken_at', trip.started_at)
    .lte('taken_at', endedAt)

  if (photosErr) {
    return { ok: false, error: photosErr.message }
  }

  const photoIds = (photos ?? []).map(p => p.id as string)
  let uploaded = 0

  // 2. Respaldar a Dropbox (solo si está conectado y hay fotos)
  if (dropboxConnected && photoIds.length > 0) {
    const res = await runBackup(trip.group_id, photoIds)
    if (!res.ok) {
      // No cerramos el viaje si el backup falla, para poder reintentar
      return { ok: false, error: res.error ?? 'Falló el respaldo a Dropbox' }
    }
    uploaded = res.uploaded ?? 0
  }

  // 3. Marcar el viaje como cerrado (con el recuento histórico)
  const { error: updErr } = await supabase
    .from('trips')
    .update({
      ended_at: endedAt,
      backed_up_at: dropboxConnected ? endedAt : null,
      photo_count: photoIds.length,
    })
    .eq('id', trip.id)

  if (updErr) {
    return { ok: false, error: updErr.message }
  }

  return { ok: true, uploaded }
}
