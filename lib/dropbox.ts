import * as AuthSession from 'expo-auth-session'
import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from './supabase'

// Necesario para que el navegador de auth se cierre y devuelva el control a la app
WebBrowser.maybeCompleteAuthSession()

// App key pública de tu app de Dropbox (no es secreto; el secret vive en la Edge Function).
// Sustituye por tu App key real, o ponlo en EXPO_PUBLIC_DROPBOX_APP_KEY en el .env.
const DROPBOX_APP_KEY = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY ?? 'TU_APP_KEY_AQUI'

const DROPBOX_AUTH_ENDPOINT = 'https://www.dropbox.com/oauth2/authorize'

// Redirect URI: usa el path 'dropbox-auth'. Dropbox exige un path/authority,
// y existe una pantalla real en app/dropbox-auth.tsx que captura este retorno
// (por eso el router ya no muestra "Unmatched Route").
// Debe coincidir EXACTAMENTE con el registrado en Dropbox: bombonsitos://dropbox-auth
function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'bombonsitos',
    path: 'dropbox-auth',
  })
}

// Genera el par PKCE (verifier + challenge S256)
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  // verifier: cadena aleatoria de 64 bytes en base64url
  const randomBytes = await Crypto.getRandomBytesAsync(64)
  const verifier = base64url(randomBytes)

  // challenge: SHA-256 del verifier, en base64url
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  )
  const challenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return { verifier, challenge }
}

function base64url(bytes: Uint8Array): string {
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  // btoa existe en el runtime de Hermes/RN
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface DropboxConnectResult {
  ok: boolean
  accountEmail?: string | null
  error?: string
}

// Lanza el flujo OAuth completo: abre el navegador, captura el código,
// y lo envía a la Edge Function dropbox-auth para obtener y guardar el refresh_token.
export async function connectDropbox(groupId: string): Promise<DropboxConnectResult> {
  try {
    const redirectUri = getRedirectUri()
    const { verifier, challenge } = await generatePKCE()

    // Construir la URL de autorización con PKCE y token_access_type=offline
    // (offline = nos da refresh_token, no solo un access_token de corta vida)
    const params = new URLSearchParams({
      client_id: DROPBOX_APP_KEY,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline',
    })
    const authUrl = `${DROPBOX_AUTH_ENDPOINT}?${params.toString()}`

    // Capturar la URL de retorno. Usamos una "carrera" entre:
    //  (a) lo que devuelve openAuthSessionAsync, y
    //  (b) un listener de Linking que intercepta el deep link bombonsitos://...
    // Esto evita que Expo Router trate la redirección como una ruta ("Unmatched Route").
    let linkingSub: { remove: () => void } | null = null
    const linkingPromise = new Promise<string>((resolve) => {
      linkingSub = Linking.addEventListener('url', (ev) => resolve(ev.url))
    })

    const browserPromise = WebBrowser.openAuthSessionAsync(authUrl, redirectUri)
      .then((r) => (r.type === 'success' && r.url ? r.url : ''))

    const returnedRaw = await Promise.race([browserPromise, linkingPromise])
    if (linkingSub) linkingSub.remove()
    // No forzamos el cierre del navegador: en Android no está disponible
    // y además se cierra solo al capturar la redirección.

    if (!returnedRaw) {
      return { ok: false, error: 'Autorización cancelada' }
    }

    // Extraer el código de la URL de retorno (con Linking.parse, robusto ante schemes)
    const parsed = Linking.parse(returnedRaw)
    const code = (parsed.queryParams?.code as string) ?? null
    if (!code) {
      const err = parsed.queryParams?.error_description as string | undefined
      return { ok: false, error: err ?? 'No se recibió el código de Dropbox' }
    }

    // Enviar el código a la Edge Function (que lo intercambia por el refresh_token)
    const { data, error } = await supabase.functions.invoke('dropbox-auth', {
      body: {
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        group_id: groupId,
      },
    })

    if (error) {
      return { ok: false, error: error.message }
    }
    if (data?.error) {
      return { ok: false, error: data.error }
    }

    return { ok: true, accountEmail: data?.account_email ?? null }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error inesperado' }
  }
}

// Estado actual de la conexión de la pareja
export async function getDropboxConnection(groupId: string) {
  const { data } = await supabase
    .from('dropbox_connections')
    .select('account_email, status, last_backup_at')
    .eq('group_id', groupId)
    .maybeSingle()
  return data
}

// Desconectar (borra la conexión guardada)
export async function disconnectDropbox(groupId: string) {
  const { error } = await supabase
    .from('dropbox_connections')
    .delete()
    .eq('group_id', groupId)
  return !error
}

// PRUEBA: sube un archivo de texto a Dropbox para validar la conexión.
export async function testDropbox(groupId: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('dropbox-test', {
    body: { group_id: groupId },
  })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true, path: data?.path }
}

// Hace backup de fotos a Dropbox.
// Si pasas photoIds, sube solo esas; si no, sube todas las pendientes.
export interface BackupResult {
  ok: boolean
  uploaded?: number
  error?: string
}
export async function runBackup(groupId: string, photoIds?: string[]): Promise<BackupResult> {
  const { data, error } = await supabase.functions.invoke('dropbox-backup', {
    body: { group_id: groupId, photo_ids: photoIds },
  })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true, uploaded: data?.uploaded ?? 0 }
}
