import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleSSO = async () => {
      // 1. Verificar si ya existe una sesión activa en Supabase
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      
      if (existingSession) {
        setUser(existingSession.user)
        setLoading(false)
        return
      }

      // 2. Si no hay sesión, buscamos el "regalo" (tokens) en la URL
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1)) // Quitamos el #
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          // Intentamos iniciar sesión con esos tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!error && data.session) {
            setUser(data.session.user)
            // Limpiamos la URL para que se vea bonita
            window.history.replaceState({}, document.title, window.location.pathname)
            setLoading(false)
            return
          }
        }
      }

      // 3. SI FALLA TODO (No sesión, no tokens) -> Expulsar al Portal
      // IMPORTANTE: Cambia esta URL si tu portal está en otro lado
      window.location.href = import.meta.env.VITE_PORTAL_URL
    }

    handleSSO()

    // Escuchar cambios de sesión futuros
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading ? children : (
        // Loader bonito mientras verifica
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Conectando con Portal...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}