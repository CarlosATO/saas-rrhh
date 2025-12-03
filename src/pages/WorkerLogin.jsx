import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

const WorkerLogin = () => {
  const navigate = useNavigate();
  const [rut, setRut] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // FUNCIÓN HELPER PARA LIMPIAR RUT
  const cleanRut = (value) => {
    return value.replace(/\./g, '').trim().toLowerCase(); // Quita puntos y espacios
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Limpiamos el RUT antes de generar el email
      // Si el usuario escribe 12.345.678-9, lo convertimos a 12345678-9
      const rutLimpio = cleanRut(rut); 
      const fakeEmail = `${rutLimpio}@sistema.local`;
      
      console.log("Intentando login con:", fakeEmail, pin); // Para depurar

      const { data, error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: pin.trim()
      });

      if (error) throw new Error("RUT o PIN incorrectos");

      navigate('/clock');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-800 p-6 text-center">
          <h2 className="text-2xl font-bold text-white">Reloj Control</h2>
          <p className="text-slate-400 text-sm">Ingreso de Trabajadores</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">RUT</label>
            <input 
              type="text" 
              placeholder="12.345.678-9" 
              className="w-full text-lg border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 outline-none font-mono"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">PIN de Acceso</label>
            <input 
              type="password" 
              placeholder="****" 
              className="w-full text-lg border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 outline-none font-mono tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
              required
            />
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded text-center text-sm font-bold">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors shadow-lg active:scale-95"
          >
            {loading ? 'Verificando...' : 'MARCAR ASISTENCIA'}
          </button>
        </form>
        
        <div className="bg-gray-50 p-4 text-center">
          <button onClick={() => window.location.href = import.meta.env.VITE_PORTAL_URL} className="text-sm text-gray-500 hover:text-gray-800 underline">
            Soy Administrador (Ir al Portal)
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerLogin;