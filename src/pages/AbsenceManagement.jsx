import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePendingRequests } from '../hooks/usePendingRequests';

const AbsenceManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pendingCount = usePendingRequests(user);
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]); // <--- NUEVO ESTADO
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  // Agregamos employee_id al formData
  const [formData, setFormData] = useState({ employee_id: '', type_id: '', start_date: '', end_date: '', reason: '' }); 

  // --- Lógica de Carga de Datos ---

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Cargar el catálogo de tipos de ausencia (GLOBAL)
      const { data: typesData } = await supabase.from('rrhh_absence_types').select('*');
      setTypes(typesData || []);

      // 2. Cargar la lista de empleados (para el Dropdown)
      const { data: empData } = await supabase.from('rrhh_employees').select('id, first_name, last_name');
      setEmployees(empData || []);

      // 3. Cargar todas las solicitudes de ausencia de la empresa
      const { data: reqData, error } = await supabase
        .from('rrhh_employee_absences')
        .select(`
          *,
          employee:employee_id(first_name, last_name),
          type:type_id(name)
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(reqData || []);

    } catch (error) {
      console.error("Error fetching data:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);


  // --- Lógica de Aprobación y Rechazo ---

  const handleStatusChange = async (requestId, newStatus) => {
    if (!window.confirm(`¿Estás seguro de ${newStatus === 'approved' ? 'APROBAR' : 'RECHAZAR'} esta solicitud?`)) return;

    try {
      const { error } = await supabase
        .from('rrhh_employee_absences')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;
      
      alert(`Solicitud ${newStatus} con éxito.`);
      fetchData(); // Refrescar la lista
    } catch (error) {
      alert(`Error al cambiar estado: ${error.message}`);
    }
  };


  // --- Lógica de Solicitud (Requester) ---

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (formData.start_date >= formData.end_date) {
        alert("La fecha de inicio debe ser anterior a la fecha de fin.");
        return;
    }
    if (!formData.employee_id) {
        alert("Debe seleccionar un empleado.");
        return;
    }

    try {
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile) return;

        const startDate = new Date(formData.start_date);
        const endDate = new Date(formData.end_date);
        const diffTime = Math.abs(endDate - startDate);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 

        const { error } = await supabase
            .from('rrhh_employee_absences')
            .insert({
                employee_id: formData.employee_id, // <--- USAMOS EL ID DEL DROPDOWN
                organization_id: profile.organization_id,
                type_id: formData.type_id,
                start_date: formData.start_date,
                end_date: formData.end_date,
                total_days: totalDays,
                reason: formData.reason,
                status: 'pending'
            });

        if (error) throw error;

        alert('Solicitud enviada para aprobación.');
        setShowRequestForm(false);
        setFormData({ employee_id: '', type_id: '', start_date: '', end_date: '', reason: '' });
        fetchData();

    } catch (error) {
        alert(`Error al solicitar: ${error.message}`);
    }
  };


  const getStatusStyle = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending':
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  // --- Renderización Principal ---

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando Gestión de Ausencias...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              Gestión de Ausencias
              {pendingCount > 0 && (
                <span className="bg-red-100 text-red-600 text-sm px-3 py-1 rounded-full border border-red-200">
                  {pendingCount} Pendientes
                </span>
              )}
            </h2>
            <p className="text-gray-500 mt-1">Solicitudes de vacaciones y permisos del equipo</p>
          </div>
          <div className="flex gap-3">
            <button 
                onClick={() => navigate('/')} 
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors shadow-sm font-medium"
            >
                ⬅ Volver a Empleados
            </button>
             <button 
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium shadow-sm transition-colors"
            >
                {showRequestForm ? 'Cancelar Solicitud' : 'Solicitar Ausencia'}
            </button>
          </div>
        </div>

        {/* Formulario de Solicitud */}
        {showRequestForm && (
            <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-indigo-100">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Enviar Solicitud Personal/Tercero</h3>
                <form onSubmit={handleSubmitRequest} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Empleado</label>
                        <select 
                            value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} required
                            className="mt-1 w-full border border-gray-300 p-2 rounded-lg bg-white"
                        >
                            <option value="">Seleccionar Empleado</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo</label>
                        <select 
                            value={formData.type_id} onChange={e => setFormData({...formData, type_id: e.target.value})} required
                            className="mt-1 w-full border border-gray-300 p-2 rounded-lg bg-white"
                        >
                            <option value="">Seleccionar Tipo</option>
                            {types.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fecha Inicio</label>
                        <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required className="mt-1 w-full border border-gray-300 p-2 rounded-lg" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fecha Fin</label>
                        <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required className="mt-1 w-full border border-gray-300 p-2 rounded-lg" />
                    </div>
                    
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Razón</label>
                        <input type="text" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} required placeholder="Ej: Viaje familiar" className="mt-1 w-full border border-gray-300 p-2 rounded-lg" />
                    </div>

                    <div className="lg:col-span-5 text-right">
                        <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium shadow-md transition-colors">
                            Enviar Solicitud
                        </button>
                    </div>
                </form>
            </div>
        )}


        {/* Tabla de Solicitudes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
          <div className="bg-gray-100 px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-700">Solicitudes Pendientes y Aprobadas ({requests.length})</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-6 py-3">Empleado</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Período (Días)</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-gray-400">No hay solicitudes de ausencias registradas.</td></tr>
                ) : (
                    requests.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900">{req.employee.first_name} {req.employee.last_name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{req.type.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{req.start_date} al {req.end_date} ({req.total_days} días)</td>
                            <td className="px-6 py-4">
                                <span className={`text-xs px-3 py-1 rounded-full font-bold ${getStatusStyle(req.status)}`}>
                                    {req.status.toUpperCase()}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {req.status === 'pending' && (
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleStatusChange(req.id, 'approved')} className="bg-emerald-500 text-white text-xs px-3 py-1 rounded hover:bg-emerald-600 transition-colors">
                                            Aprobar
                                        </button>
                                        <button onClick={() => handleStatusChange(req.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600 transition-colors">
                                            Rechazar
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AbsenceManagement;