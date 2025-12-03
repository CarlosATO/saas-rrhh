import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AttendanceControl = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtro de Mes (Por defecto el mes actual: YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 

  // --- Lógica de Carga ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Obtener ID de la empresa del usuario actual
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      
      if (profile?.organization_id) {
          // 2. Calcular rango de fechas para el mes seleccionado
          const [year, month] = selectedMonth.split('-');
          const startDate = `${year}-${month}-01`;
          const endDate = `${year}-${month}-31`; 

          // 3. Consultar la VISTA SQL (v_daily_attendance)
          const { data, error } = await supabase
            .from('v_daily_attendance')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: false });

          if (error) throw error;
          setAttendanceData(data || []);
      }
    } catch (error) {
      console.error("Error cargando asistencia:", error.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // --- Helpers Visuales ---
  const formatTime = (isoString) => {
      if (!isoString) return '--:--';
      // Ajustamos a hora local
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatus = (record) => {
      if (!record.first_in) return { label: 'AUSENTE', color: 'bg-red-100 text-red-800' };
      
      // Cálculo simple de atraso
      if (record.shift_start) {
          const entryTime = new Date(record.first_in);
          const [h, m] = record.shift_start.split(':');
          const shiftTime = new Date(record.first_in); 
          shiftTime.setHours(h, m, 0);
          
          // Sumar tolerancia
          const tolerance = record.tolerance_minutes || 0;
          shiftTime.setMinutes(shiftTime.getMinutes() + tolerance);

          if (entryTime > shiftTime) {
              return { label: 'ATRASO', color: 'bg-yellow-100 text-yellow-800 font-bold' };
          }
      }
      
      if (!record.last_out) return { label: 'S/ SALIDA', color: 'bg-orange-100 text-orange-800' };

      return { label: 'OK', color: 'bg-emerald-100 text-emerald-800' };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Control de Asistencia</h2>
            <p className="text-slate-500 mt-1">Revisión de marcas y atrasos mensuales.</p>
          </div>
          <div className="flex gap-3">
             <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border p-2 rounded-lg bg-white shadow-sm font-medium text-slate-700"
             />
             <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium">
                ⬅ Volver
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-500">
                    <tr>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Empleado</th>
                        <th className="p-4">Turno</th>
                        <th className="p-4 text-center">Entrada</th>
                        <th className="p-4 text-center">Salida</th>
                        <th className="p-4 text-center">Estado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading && <tr><td colSpan="6" className="p-10 text-center text-slate-400">Cargando datos...</td></tr>}
                    {!loading && attendanceData.length === 0 && (
                        <tr><td colSpan="6" className="p-10 text-center text-slate-400">No hay registros para este mes.</td></tr>
                    )}
                    {attendanceData.map((row, index) => {
                        const status = getStatus(row);
                        return (
                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-slate-900 font-medium whitespace-nowrap">
                                    {/* Mostrar solo fecha local */}
                                    {new Date(row.work_date + 'T12:00:00').toLocaleDateString()} 
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-slate-800">{row.first_name} {row.last_name}</div>
                                    <div className="text-xs text-slate-400">{row.rut}</div>
                                </td>
                                <td className="p-4 text-xs text-slate-500">
                                    {row.shift_start ? `${row.shift_start.slice(0,5)} - ${row.shift_end.slice(0,5)}` : 'Sin turno'}
                                </td>
                                <td className="p-4 text-center font-mono text-slate-700">{formatTime(row.first_in)}</td>
                                <td className="p-4 text-center font-mono text-slate-700">{formatTime(row.last_out)}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-xs border text-[10px] uppercase tracking-wider ${status.color}`}>
                                        {status.label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

      </div>
    </div>
  );
};

export default AttendanceControl;