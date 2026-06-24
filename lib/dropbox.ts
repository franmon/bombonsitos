import * as AuthSession from 'expo-auth-session'
import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'

// Necesario para que el navegador de auth se cierre y devuelva el control a la app
WebBrowser.maybeCompleteAuthSession()

// App key pública de tu app de Dropbox (no es secreto; el secret vive en la Edge Function).
// Sustituye por tu App key real, o ponlo en EXPO_PUBLIC_DROPBOX_APP_KEY en el .env.
//const DROPBOX_APP_KEY = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY ?? '93j3mopc6uclfkd'
const DROPBOX_APP_KEY = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY!

const DROPBOX_AUTH_ENDPOINT = 'https://www.dropbox.com/oauth2/authorize'

// Redirect URI: debe coincidir EXACTAMENTE con el que añadiste en el panel de Dropbox.
// scheme 'bombonsitos' (del app.json) + ruta 'dropbox-auth'.
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
    console.log('REDIRECT URI GENERADO:', redirectUri)
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

    // Abrir el navegador y esperar la redirección de vuelta
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

    if (result.type !== 'success' || !result.url) {
      return { ok: false, error: 'Autorización cancelada' }
    }

    // Extraer el código de la URL de retorno
    const returnedUrl = new URL(result.url)
    const code = returnedUrl.searchParams.get('code')
    if (!code) {
      const err = returnedUrl.searchParams.get('error_description')
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
