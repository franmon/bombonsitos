// Edge Function: dropbox-auth
// Intercambia el código de autorización de Dropbox (flujo OAuth con PKCE)
// por un refresh_token de larga duración, y lo guarda en dropbox_connections.
//
// La app NUNCA ve el App secret: vive como secreto del servidor.
// La app solo manda: code, code_verifier, redirect_uri y group_id.
//
// Secretos necesarios (supabase secrets set ...):
//   DROPBOX_APP_KEY
//   DROPBOX_APP_SECRET
// Variables ya disponibles en el entorno de la función:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    // 1. Identificar al usuario que hace la petición (debe estar autenticado)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autenticado' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente con el token del usuario, solo para saber quién es
    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return json({ error: 'Sesión inválida' }, 401)
    }
    const userId = userData.user.id

    // 2. Leer el cuerpo de la petición
    const body = await req.json()
    const { code, code_verifier, redirect_uri, group_id } = body
    if (!code || !code_verifier || !redirect_uri || !group_id) {
      return json({ error: 'Faltan parámetros (code, code_verifier, redirect_uri, group_id)' }, 400)
    }

    // 3. Verificar que el usuario pertenece a esa pareja (group)
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: membership } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!membership) {
      return json({ error: 'No perteneces a esta pareja' }, 403)
    }

    // 4. Intercambiar el código por tokens en Dropbox
    const appKey = Deno.env.get('DROPBOX_APP_KEY')!
    const appSecret = Deno.env.get('DROPBOX_APP_SECRET')!

    const form = new URLSearchParams()
    form.set('code', code)
    form.set('grant_type', 'authorization_code')
    form.set('redirect_uri', redirect_uri)
    form.set('code_verifier', code_verifier)
    form.set('client_id', appKey)
    form.set('client_secret', appSecret)

    const tokenResp = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })

    const tokenData = await tokenResp.json()
    if (!tokenResp.ok || !tokenData.refresh_token) {
      return json({ error: 'Dropbox rechazó el código', detail: tokenData }, 400)
    }

    // 5. Obtener el email de la cuenta (informativo)
    let accountEmail: string | null = null
    try {
      const acc = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (acc.ok) {
        const accData = await acc.json()
        accountEmail = accData?.email ?? null
      }
    } catch {
      // si falla, no pasa nada, es solo informativo
    }

    // 6. Guardar (o actualizar) la conexión de la pareja
    const { error: upsertErr } = await admin
      .from('dropbox_connections')
      .upsert({
        group_id,
        connected_by: userId,
        refresh_token: tokenData.refresh_token,
        account_email: accountEmail,
        status: 'connected',
      }, { onConflict: 'group_id' })

    if (upsertErr) {
      return json({ error: 'No se pudo guardar la conexión', detail: upsertErr.message }, 500)
    }

    return json({ ok: true, account_email: accountEmail })
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
