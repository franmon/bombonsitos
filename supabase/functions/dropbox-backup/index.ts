// Edge Function: dropbox-backup
// Sube a Dropbox las fotos de la pareja que aún no están respaldadas
// (photos.backed_up_at IS NULL). Para cada una: la descarga del bucket 'photos'
// de Supabase Storage, la sube a Dropbox y marca backed_up_at.
//
// Llamada desde la app: supabase.functions.invoke('dropbox-backup', { body: { group_id } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Máximo de fotos por llamada, para no exceder el tiempo de ejecución
const MAX_PER_RUN = 25

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autenticado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Identificar al usuario
    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Sesión inválida' }, 401)
    const userId = userData.user.id

    const { group_id } = await req.json()
    if (!group_id) return json({ error: 'Falta group_id' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    // Verificar pertenencia
    const { data: membership } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!membership) return json({ error: 'No perteneces a esta pareja' }, 403)

    // Conexión de Dropbox
    const { data: conn } = await admin
      .from('dropbox_connections')
      .select('refresh_token, folder_path')
      .eq('group_id', group_id)
      .maybeSingle()
    if (!conn?.refresh_token) {
      return json({ error: 'No hay conexión de Dropbox para esta pareja' }, 400)
    }

    // Fotos pendientes de respaldar
    const { data: photos, error: photosErr } = await admin
      .from('photos')
      .select('id, storage_path, taken_at')
      .eq('group_id', group_id)
      .is('backed_up_at', null)
      .order('taken_at', { ascending: true })
      .limit(MAX_PER_RUN)

    if (photosErr) return json({ error: 'Error leyendo fotos', detail: photosErr.message }, 500)
    if (!photos || photos.length === 0) {
      return json({ ok: true, uploaded: 0, message: 'No hay fotos pendientes' })
    }

    // Obtener access_token de Dropbox
    const appKey = Deno.env.get('DROPBOX_APP_KEY')!
    const appSecret = Deno.env.get('DROPBOX_APP_SECRET')!
    const tokenForm = new URLSearchParams()
    tokenForm.set('grant_type', 'refresh_token')
    tokenForm.set('refresh_token', conn.refresh_token)
    tokenForm.set('client_id', appKey)
    tokenForm.set('client_secret', appSecret)

    const tokenResp = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenForm.toString(),
    })
    const tokenData = await tokenResp.json()
    if (!tokenResp.ok || !tokenData.access_token) {
      return json({ error: 'No se pudo refrescar el token', detail: tokenData }, 400)
    }
    const accessToken = tokenData.access_token

    const baseFolder = conn.folder_path || '/BombonsitosBackups'
    let uploaded = 0
    const errors: string[] = []

    for (const photo of photos) {
      try {
        // Descargar la foto del bucket 'photos'
        const { data: blob, error: dlErr } = await admin.storage
          .from('photos')
          .download(photo.storage_path)
        if (dlErr || !blob) {
          errors.push(`${photo.storage_path}: no se pudo descargar`)
          continue
        }

        const bytes = new Uint8Array(await blob.arrayBuffer())

        // Nombre del archivo en Dropbox: usar el nombre base del storage_path
        const fileName = photo.storage_path.split('/').pop() ?? `${photo.id}.jpg`
        const dropboxPath = `${baseFolder}/${fileName}`

        const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              path: dropboxPath,
              mode: 'add',
              autorename: true,
              mute: true,
            }),
          },
          body: bytes,
        })

        if (!uploadResp.ok) {
          const detail = await uploadResp.text()
          errors.push(`${fileName}: Dropbox rechazó (${detail.slice(0, 120)})`)
          continue
        }

        // Marcar como respaldada
        await admin
          .from('photos')
          .update({ backed_up_at: new Date().toISOString() })
          .eq('id', photo.id)

        uploaded++
      } catch (e) {
        errors.push(`${photo.storage_path}: ${String(e)}`)
      }
    }

    // Actualizar last_backup_at de la conexión
    await admin
      .from('dropbox_connections')
      .update({ last_backup_at: new Date().toISOString() })
      .eq('group_id', group_id)

    return json({
      ok: true,
      uploaded,
      total_pending: photos.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (e) {
    return json({ error: 'Error inesperado', detail: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
