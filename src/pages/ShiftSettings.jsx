import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ShiftSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newShift, setNewShift] = useState({ name: '', start_time: '09:00', end_time: '18:00', tolerance_minutes: 15 });
  const [organizationId, setOrganizationId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (profile?.organization_id) {
          setOrganizationId(profile.organization_id);
          const { data } = await supabase.from('rrhh_shifts').select('*').eq('organization_id', profile.organization_id).order('name');
          setShifts(data || []);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('rrhh_shifts').insert({
        organization_id: organizationId,
        ...newShift
      });
      if (error) throw error;
      setNewShift({ name: '', start_time: '09:00', end_time: '18:00', tolerance_minutes: 15 });
      fetchData();
    } catch (error) { alert('Error: ' + error.message); }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("¿Borrar turno?")) return;
    try {
        await supabase.from('rrhh_shifts').delete().eq('id', id);
        fetchData();
    } catch (error) { alert("Error al eliminar."); }
  };

  if (loading) return <div className="p-10 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Turnos de Trabajo</h2>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border rounded hover:bg-gray-50">⬅ Volver</button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md mb-8 border">
            <h3 className="font-bold text-lg mb-4">Nuevo Turno</h3>
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="text-xs block text-gray-500">Nombre Turno</label>
                    <input className="w-full border p-2 rounded" placeholder="Ej: Administrativo" 
                        value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} required />
                </div>
                <div>
                    <label className="text-xs block text-gray-500">Entrada</label>
                    <input type="time" className="w-full border p-2 rounded" 
                        value={newShift.start_time} onChange={e => setNewShift({...newShift, start_time: e.target.value})} required />
                </div>
                <div>
                    <label className="text-xs block text-gray-500">Salida</label>
                    <input type="time" className="w-full border p-2 rounded" 
                        value={newShift.end_time} onChange={e => setNewShift({...newShift, end_time: e.target.value})} required />
                </div>
                <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded h-[42px]">Guardar</button>
            </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase">
                    <tr><th className="p-4">Nombre</th><th className="p-4">Horario</th><th className="p-4">Tolerancia</th><th className="p-4"></th></tr>
                </thead>
                <tbody className="divide-y">
                    {shifts.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50">
                            <td className="p-4 font-medium">{s.name}</td>
                            <td className="p-4">{s.start_time} - {s.end_time}</td>
                            <td className="p-4 text-sm text-gray-500">{s.tolerance_minutes} min</td>
                            <td className="p-4 text-right">
                                <button onClick={() => handleDelete(s.id)} className="text-red-500 text-sm hover:underline">Eliminar</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default ShiftSettings;