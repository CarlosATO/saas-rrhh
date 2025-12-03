import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CourseSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCourse, setNewCourse] = useState({ name: '', validity_months: 12 });
  const [organizationId, setOrganizationId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (profile?.organization_id) {
          setOrganizationId(profile.organization_id);
          const { data } = await supabase.from('rrhh_course_catalog').select('*').eq('organization_id', profile.organization_id).order('name');
          setCourses(data || []);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newCourse.name) return;
    try {
      const { error } = await supabase.from('rrhh_course_catalog').insert({
        organization_id: organizationId,
        name: newCourse.name,
        validity_months: newCourse.validity_months
      });
      if (error) throw error;
      setNewCourse({ name: '', validity_months: 12 });
      fetchData();
    } catch (error) { alert('Error: ' + error.message); }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("¿Borrar curso?")) return;
    try {
        await supabase.from('rrhh_course_catalog').delete().eq('id', id);
        fetchData();
    } catch (error) { alert("Error al eliminar."); }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando cursos...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Catálogo de Cursos</h2>
            <p className="text-slate-500 mt-1">Cursos obligatorios y certificaciones.</p>
          </div>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium">
             ⬅ Volver
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-800">Nuevo Curso</h3>
            <form onSubmit={handleSave} className="flex gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-sm text-slate-700 mb-1">Nombre del Curso</label>
                    <input className="w-full border p-2 rounded" placeholder="Ej: Trabajo en Altura" 
                        value={newCourse.name} onChange={e => setNewCourse({...newCourse, name: e.target.value})} required />
                </div>
                <div className="w-32">
                    <label className="block text-sm text-slate-700 mb-1">Vigencia (Meses)</label>
                    <input type="number" className="w-full border p-2 rounded" 
                        value={newCourse.validity_months} onChange={e => setNewCourse({...newCourse, validity_months: e.target.value})} />
                </div>
                <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded hover:bg-slate-800 font-medium h-[42px]">
                    Agregar
                </button>
            </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {courses.length === 0 ? <li className="p-6 text-center text-gray-400">Sin cursos definidos.</li> : courses.map(c => (
                    <li key={c.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                        <div>
                            <span className="font-medium text-slate-900 block">{c.name}</span>
                            <span className="text-xs text-slate-500">Vigencia: {c.validity_months} meses</span>
                        </div>
                        <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Eliminar</button>
                    </li>
                ))}
            </ul>
        </div>

      </div>
    </div>
  );
};

export default CourseSettings;