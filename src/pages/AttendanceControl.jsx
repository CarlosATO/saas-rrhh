import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const AttendanceControl = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados de Datos
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE FILTRO ---
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterDate, setFilterDate] = useState(''); // <--- NUEVO: Filtro por Día Exacto
  const [searchTerm, setSearchTerm] = useState(''); // Filtro por Texto

  // Estados del Inspector
  const [selectedDay, setSelectedDay] = useState(null); 
  const [dailyLogs, setDailyLogs] = useState([]);
  const [newLogTime, setNewLogTime] = useState('');
  const [newLogType, setNewLogType] = useState('IN');

  // --- 1. Lógica de Carga (Server-Side) ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      
      if (profile?.organization_id) {
          const [year, month] = selectedMonth.split('-');
          const startDate = `${year}-${month}-01`;
          const endDate = `${year}-${month}-31`; 

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

  // --- 2. Lógica de Filtrado (Client-Side) ---
  const filteredData = useMemo(() => {
      let data = attendanceData;

      // A. Filtro por Día Exacto (Si está seleccionado)
      if (filterDate) {
          data = data.filter(row => row.work_date === filterDate);
      }

      // B. Filtro por Texto (Nombre o RUT)
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          data = data.filter(row => 
              row.first_name?.toLowerCase().includes(lowerTerm) ||
              row.last_name?.toLowerCase().includes(lowerTerm) ||
              row.rut?.includes(lowerTerm)
          );
      }

      return data;
  }, [attendanceData, searchTerm, filterDate]);


  // --- Funciones del Inspector ---

  const openInspector = async (record) => {
    const date = record.work_date;
    const { data: logs } = await supabase.from('rrhh_attendance_logs')
        .select('*')
        .eq('employee_id', record.employee_id)
        .gte('timestamp', `${date}T00:00:00.000Z`)
        .lte('timestamp', `${date}T23:59:59.999Z`)
        .order('timestamp', { ascending: true });
    
    setDailyLogs(logs || []);
    setSelectedDay(record);
  };

  const handleManualLog = async (e) => {
    e.preventDefault();
    if (!selectedDay || !newLogTime) return;
    try {
      const logDateTime = new Date(`${selectedDay.work_date}T${newLogTime}:00`);
      const { error } = await supabase.from('rrhh_attendance_logs').insert({
        employee_id: selectedDay.employee_id, organization_id: selectedDay.organization_id, 
        type: newLogType, timestamp: logDateTime.toISOString(), device_info: 'MANUAL_ADMIN', 
      });
      if (error) throw error;
      
      const { data: logs } = await supabase.from('rrhh_attendance_logs').select('*')
        .eq('employee_id', selectedDay.employee_id)
        .gte('timestamp', `${selectedDay.work_date}T00:00:00`).lte('timestamp', `${selectedDay.work_date}T23:59:59`).order('timestamp', { ascending: true });
      setDailyLogs(logs || []);
      fetchData(); 
      setNewLogTime('');
    } catch (error) { alert("Error: " + error.message); }
  };

  const handleDeleteLog = async (logId) => {
      if(!window.confirm("¿Borrar esta marca?")) return;
      try {
          const { error } = await supabase.from('rrhh_attendance_logs').delete().eq('id', logId);
          if (error) throw error;
          setDailyLogs(prevLogs => prevLogs.filter(log => log.id !== logId));
          await fetchData(); 
          if (dailyLogs.length <= 1) setSelectedDay(null); 
      } catch (error) { alert("Error al borrar: " + error.message); }
  };

  const formatTime = (isoString) => {
      if (!isoString) return '--:--';
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDeviceLabel = (info) => {
      if (!info) return 'Desconocido';
      if (info === 'MANUAL_ADMIN') return '👤 Manual (Admin)';
      if (info.includes('Mobile')) return '📱 Celular';
      return '💻 Computadora';
  };

  const getStatus = (record) => {
      if (!record.first_in) return { label: 'AUSENTE', color: 'bg-red-100 text-red-800' };
      if (record.shift_start) {
          const entryTime = new Date(record.first_in);
          const [h, m] = record.shift_start.split(':');
          const shiftTime = new Date(record.first_in); 
          shiftTime.setHours(h, m, 0);
          const tolerance = record.tolerance_minutes || 0;
          shiftTime.setMinutes(shiftTime.getMinutes() + tolerance);
          if (entryTime > shiftTime) return { label: 'ATRASO', color: 'bg-yellow-100 text-yellow-800 font-bold' };
      }
      if (!record.last_out) return { label: 'S/ SALIDA', color: 'bg-orange-100 text-orange-800' };
      return { label: 'OK', color: 'bg-emerald-100 text-emerald-800' };
  };

  // Handler inteligente para el cambio de fecha
  const handleDateFilterChange = (e) => {
      const newDate = e.target.value;
      setFilterDate(newDate);
      
      // Si el usuario elige un día, actualizamos el MES automáticamente para cargar los datos correctos
      if (newDate) {
          const newMonth = newDate.slice(0, 7); // "2025-12-05" -> "2025-12"
          if (newMonth !== selectedMonth) {
              setSelectedMonth(newMonth);
          }
      }
  };

  // Función para exportar a Excel
  const handleExport = () => {
      if (filteredData.length === 0) {
          alert("No hay datos para exportar.");
          return;
      }

      // 1. Preparar los datos para Excel (formatearlos bonitos)
      const dataToExport = filteredData.map(row => {
          // Calcular estado texto simple
          let estado = 'OK';
          if (!row.first_in) estado = 'AUSENTE';
          else if (!row.last_out) estado = 'S/ SALIDA';
          else if (row.shift_start) {
               const entryTime = new Date(row.first_in);
               const [h, m] = row.shift_start.split(':');
               const shiftTime = new Date(row.first_in);
               shiftTime.setHours(h, m, 0);
               const tolerance = row.tolerance_minutes || 0;
               shiftTime.setMinutes(shiftTime.getMinutes() + tolerance);
               if (entryTime > shiftTime) estado = 'ATRASO';
          }

          return {
              Fecha: new Date(row.work_date + 'T12:00:00').toLocaleDateString('es-CL'),
              Nombre: row.first_name,
              Apellido: row.last_name,
              RUT: row.rut,
              Turno: row.shift_start ? `${row.shift_start.slice(0,5)} - ${row.shift_end.slice(0,5)}` : 'Sin turno',
              Entrada: row.first_in ? new Date(row.first_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--',
              Salida: row.last_out ? new Date(row.last_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--',
              Estado: estado
          };
      });

      // 2. Crear Libro y Hoja
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");

      // 3. Descargar Archivo
      XLSX.writeFile(workbook, `Asistencia_${selectedMonth}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* TOOLBAR MEJORADO Y ALINEADO */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6">
            
            {/* Fila 1: Título y Contador */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Control de Asistencia</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {filterDate 
                            ? `📅 ${new Date(filterDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` 
                            : `📊 ${filteredData.length} registros en ${new Date(selectedMonth + '-01').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}`}
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Botón Exportar */}
                    <button 
                        onClick={handleExport}
                        className="px-4 py-2 bg-emerald-600 border border-emerald-700 rounded-lg text-white hover:bg-emerald-700 font-medium text-sm transition-colors flex items-center gap-2 shadow-sm"
                    >
                        📥 Excel
                    </button>
                    <button 
                        onClick={() => navigate('/')} 
                        className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-200 font-medium text-sm transition-colors"
                    >
                        ⬅ Volver
                    </button>
                </div>
            </div>

            {/* Fila 2: Filtros Alineados */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                
                {/* 1. Buscador de Texto */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Buscar Empleado</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Nombre, apellido o RUT..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. Filtro por Día Específico */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Día Específico</label>
                    <input 
                        type="date" 
                        value={filterDate} 
                        onChange={handleDateFilterChange}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>

                {/* 3. Filtro por Mes */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Mes Completo</label>
                    <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            setFilterDate('');
                        }}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Botones de Limpieza (Opcional) */}
            {(searchTerm || filterDate) && (
                <div className="mt-3 flex gap-2">
                    <button 
                        onClick={() => {
                            setSearchTerm('');
                            setFilterDate('');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                        ✕ Limpiar todos los filtros
                    </button>
                </div>
            )}
        </div>

        {/* TABLA DE DATOS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-500">
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
                    
                    {!loading && filteredData.length === 0 && (
                        <tr><td colSpan="6" className="p-12 text-center text-slate-400">
                            No se encontraron registros.
                        </td></tr>
                    )}

                    {filteredData.map((row, index) => {
                        const status = getStatus(row);
                        return (
                            <tr key={index} onClick={() => openInspector(row)} className="hover:bg-blue-50 transition-colors cursor-pointer group">
                                <td className="p-4 text-slate-900 font-medium whitespace-nowrap">
                                    {new Date(row.work_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} 
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-slate-800">{row.first_name} {row.last_name}</div>
                                    <div className="text-xs text-slate-400 font-mono">{row.rut}</div>
                                </td>
                                <td className="p-4 text-xs text-slate-500">
                                    {row.shift_start ? `${row.shift_start.slice(0,5)} - ${row.shift_end.slice(0,5)}` : <span className="text-orange-400">Sin turno</span>}
                                </td>
                                <td className="p-4 text-center font-mono text-slate-700 bg-slate-50/50">{formatTime(row.first_in)}</td>
                                <td className="p-4 text-center font-mono text-slate-700 bg-slate-50/50">{formatTime(row.last_out)}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-wider font-bold ${status.color}`}>
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

      {/* --- MODAL INSPECTOR (Sin cambios) --- */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={() => setSelectedDay(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800">Inspector de Marcas</h3>
                    <button onClick={() => setSelectedDay(null)} className="text-2xl text-gray-400 hover:text-slate-600">&times;</button>
                </div>
                <div className="p-5 space-y-5">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xl font-bold text-slate-900">{selectedDay.first_name} {selectedDay.last_name}</p>
                            <p className="text-sm text-slate-500">{new Date(selectedDay.work_date + 'T12:00:00').toLocaleDateString()}</p>
                        </div>
                        <div className="text-right text-xs">
                            <span className="block font-bold text-slate-600">TURNO</span>
                            {selectedDay.shift_start ? `${selectedDay.shift_start.slice(0,5)} a ${selectedDay.shift_end.slice(0,5)}` : 'N/A'}
                        </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 flex justify-between">
                            <span>HORA</span><span>DISPOSITIVO</span><span>ACCIÓN</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {dailyLogs.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Sin marcas.</p>}
                            {dailyLogs.map(log => (
                                <div key={log.id} className="flex justify-between items-center p-3 hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded w-16 text-center ${log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{log.type}</span>
                                        <span className="font-mono text-lg font-medium text-slate-700">{formatTime(log.timestamp)}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-gray-400" title={log.device_info}>{getDeviceLabel(log.device_info)}</span>
                                        <button onClick={() => handleDeleteLog(log.id)} className="text-gray-300 hover:text-red-500 p-1">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Corrección Manual</p>
                        <form onSubmit={handleManualLog} className="flex gap-2">
                            <select value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="border p-2 rounded text-sm bg-white font-medium">
                                <option value="IN">ENTRADA</option><option value="OUT">SALIDA</option>
                            </select>
                            <input type="time" value={newLogTime} onChange={(e) => setNewLogTime(e.target.value)} required className="border p-2 rounded text-sm flex-1" />
                            <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-700 shadow-sm">+ Añadir</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceControl;