import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile, Group } from '@/types/database'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null | undefined
  currentGroup: Group | null
  isAdmin: boolean
  loading: boolean
  setCurrentGroup: (group: Group | null) => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  currentGroup: null,
  isAdmin: false,
  loading: true,
  setCurrentGroup: () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cargar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }).catch(() => {
      // Si getSession falla, no quedarse colgado en el spinner
      setLoading(false)
    })

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setCurrentGroup(null)
          setIsAdmin(false)
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Recalcular isAdmin cuando cambia el grupo
  useEffect(() => {
    if (!user || !currentGroup) {
      setIsAdmin(false)
      return
    }
    supabase
      .from('group_members')
      .select('role')
      .eq('group_id', currentGroup.id)
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(data?.role === 'admin'))
  }, [user, currentGroup])

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data ?? null)

      const { data: membership } = await supabase
        .from('group_members')
        .select('group:groups(*)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (membership?.group) {
        setCurrentGroup(membership.group as any)
      }
    } catch (e) {
      // Si algo falla, no dejar el perfil en undefined (eso colgaría el spinner)
      setProfile(null)
    } finally {
      // Pase lo que pase, terminamos la carga
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session, user, profile, currentGroup, isAdmin, loading,
      setCurrentGroup, refreshProfile, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
