import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext()

// URL del portal para redirección (Admin)
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleSSO = async () => {
      
      // --- 1. LISTA BLANCA (EXCEPCIONES) ---
      // Si el usuario está intentando entrar al Login de Trabajadores,
      // NO hacemos nada de seguridad. Dejamos que cargue la página.
      if (window.location.pathname === '/worker-login') {
          setLoading(false);
          return;
      }

      // --- 2. Lógica Normal de Sesión ---
      
      // A. Verificar si ya existe una sesión activa
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      
      if (existingSession) {
        setUser(existingSession.user)
        setLoading(false)
        return
      }

      // B. Si no hay sesión, buscamos tokens en la URL (SSO desde Portal)
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!error && data.session) {
            setUser(data.session.user)
            window.history.replaceState({}, document.title, window.location.pathname)
            setLoading(false)
            return
          }
        }
      }

      // C. SI FALLA TODO -> Expulsar al Portal (Login Administrativo)
      window.location.href = PORTAL_URL
    }

    handleSSO()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading ? children : (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Verificando acceso...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}