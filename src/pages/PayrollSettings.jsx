import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchEconomicIndicators } from '../services/indicatorsService';

const PayrollSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados de Carga
  const [loading, setLoading] = useState(false); // Carga general (Guardar/BD)
  const [apiLoading, setApiLoading] = useState(false); // Carga específica de API
  
  // Mes a configurar (Por defecto el actual)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Valores Económicos
  const [params, setParams] = useState({
      uf_value: 0,
      utm_value: 0,
      min_wage: 500000, 
      top_limit_afp: 84.3, 
      top_limit_cesantia: 126.6, 
  });

  const [organizationId, setOrganizationId] = useState(null);

  // 1. Obtener ID Organización
  useEffect(() => {
      const getOrg = async () => {
          const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
          if (data) setOrganizationId(data.organization_id);
      };
      if (user) getOrg();
  }, [user]);

  // 2. Lógica Combinada: Cargar BD + Actualizar API
  useEffect(() => {
      if (!organizationId) return;

      const loadDataSequence = async () => {
          // A. Primero cargamos lo guardado en BD (si existe)
          setLoading(true);
          try {
              const periodDate = `${selectedMonth}-01`;
              const { data } = await supabase
                  .from('rrhh_payroll_parameters')
                  .select('*')
                  .eq('organization_id', organizationId)
                  .eq('period_date', periodDate)
                  .single();

              if (data) {
                  setParams({
                      uf_value: data.uf_value,
                      utm_value: data.utm_value,
                      min_wage: data.min_wage,
                      top_limit_afp: data.top_limit_afp,
                      top_limit_cesantia: data.top_limit_cesantia
                  });
              }
          } catch (error) {
              // Ignoramos error si no hay datos guardados
          } finally {
              setLoading(false);
          }

          // B. AUTOMÁTICAMENTE actualizamos con la API (Overwrite fresco)
          setApiLoading(true);
          try {
              const apiData = await fetchEconomicIndicators();
              // Actualizamos el estado con los valores frescos de la API
              // (Manteniendo los otros valores que la API no trae, como sueldo mínimo si ya estaba puesto)
              setParams(prev => ({
                  ...prev,
                  uf_value: apiData.uf.valor,
                  utm_value: apiData.utm.valor,
                  // Nota: Podrías mapear el dólar u otros si quisieras
              }));
          } catch (error) {
              console.error("No se pudo auto-actualizar desde la API");
          } finally {
              setApiLoading(false);
          }
      };

      loadDataSequence();

  }, [organizationId, selectedMonth]); // Se ejecuta al entrar o cambiar de mes


  // 3. Guardar en Base de Datos
  const handleSave = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
          const periodDate = `${selectedMonth}-01`;
          
          const { error } = await supabase
            .from('rrhh_payroll_parameters')
            .upsert({
                organization_id: organizationId,
                period_date: periodDate,
                uf_value: params.uf_value,
                utm_value: params.utm_value,
                min_wage: params.min_wage,
                top_limit_afp: params.top_limit_afp,
                top_limit_cesantia: params.top_limit_cesantia
            }, { onConflict: 'organization_id, period_date' });

          if (error) throw error;
          alert("Parámetros guardados y confirmados.");

      } catch (error) {
          alert("Error al guardar: " + error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleChange = (e) => {
      setParams({ ...params, [e.target.name]: parseFloat(e.target.value) });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Parámetros de Remuneración</h2>
            <p className="text-slate-500 mt-1">Configuración mensual para cálculo de sueldos.</p>
          </div>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium">
             ⬅ Volver
          </button>
        </div>

        {/* MENSAJE DE CARGA AUTOMÁTICA (Feedback Visual) */}
        {apiLoading && (
            <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded shadow-sm animate-pulse flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-blue-700 font-medium text-sm">
                    Actualizando valores con mindicador.cl...
                </p>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            
            {/* Barra de Selección de Mes */}
            <div className="bg-slate-100 p-6 border-b flex items-center gap-4">
                <label className="font-bold text-slate-700">Periodo (Mes):</label>
                <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border p-2 rounded-lg font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Formulario */}
            <form onSubmit={handleSave} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Sección 1: Indicadores Económicos */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex justify-between">
                        Indicadores Económicos
                        {/* Indicador sutil de fuente */}
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded uppercase tracking-wider font-normal">
                            Auto-Sync
                        </span>
                    </h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Valor UF ($)</label>
                        <input type="number" step="0.01" name="uf_value" value={params.uf_value} onChange={handleChange} 
                            className="w-full border p-3 rounded-lg text-right font-mono bg-blue-50/50 focus:bg-white transition-colors border-blue-200 focus:border-blue-500" />
                        <p className="text-[10px] text-slate-400 mt-1 text-right">Valor del día obtenido automáticamente</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Valor UTM ($)</label>
                        <input type="number" step="0.01" name="utm_value" value={params.utm_value} onChange={handleChange} 
                            className="w-full border p-3 rounded-lg text-right font-mono bg-blue-50/50 focus:bg-white transition-colors border-blue-200 focus:border-blue-500" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Sueldo Mínimo Legal ($)</label>
                        <input type="number" name="min_wage" value={params.min_wage} onChange={handleChange} 
                            className="w-full border p-3 rounded-lg text-right font-mono bg-slate-50 focus:bg-white transition-colors border-slate-300" />
                    </div>
                </div>

                {/* Sección 2: Topes Legales */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Topes Imponibles (UF)</h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Tope AFP (UF)</label>
                        <input type="number" step="0.1" name="top_limit_afp" value={params.top_limit_afp} onChange={handleChange} 
                            className="w-full border p-3 rounded-lg text-right font-mono bg-slate-50 focus:bg-white transition-colors border-slate-300" />
                        <p className="text-xs text-slate-400 mt-1 text-right">Aprox 84.3 UF</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Tope Seguro Cesantía (UF)</label>
                        <input type="number" step="0.1" name="top_limit_cesantia" value={params.top_limit_cesantia} onChange={handleChange} 
                            className="w-full border p-3 rounded-lg text-right font-mono bg-slate-50 focus:bg-white transition-colors border-slate-300" />
                        <p className="text-xs text-slate-400 mt-1 text-right">Aprox 126.6 UF</p>
                    </div>
                </div>

                {/* Botón Guardar */}
                <div className="md:col-span-2 pt-6 border-t flex justify-end">
                    <button type="submit" disabled={loading} className="bg-emerald-600 text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-emerald-700 shadow-lg transform active:scale-95 transition-all flex items-center gap-2">
                        {loading ? 'Guardando...' : '💾 Confirmar y Guardar'}
                    </button>
                </div>

            </form>
        </div>
      </div>
    </div>
  );
};

export default PayrollSettings;