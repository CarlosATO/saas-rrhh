import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SubcontractorSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    rut: '', business_name: '', legal_representative: '', contact_email: '' 
  });
  const [organizationId, setOrganizationId] = useState(null);

  // --- Carga de Datos ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Obtener Org ID
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (profile?.organization_id) {
          setOrganizationId(profile.organization_id);
          
          // 2. Obtener Subcontratistas
          const { data, error } = await supabase
            .from('rrhh_subcontractors')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('business_name', { ascending: true });
            
          if (error) throw error;
          setSubs(data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // --- Guardar Nuevo Subcontratista ---
  const handleSave = async (e) => {
    e.preventDefault();
    if (!organizationId) return;

    try {
      const { error } = await supabase.from('rrhh_subcontractors').insert({
        organization_id: organizationId,
        rut: formData.rut,
        business_name: formData.business_name,
        legal_representative: formData.legal_representative,
        contact_email: formData.contact_email
      });

      if (error) throw error;

      alert('Empresa contratista agregada correctamente.');
      setFormData({ rut: '', business_name: '', legal_representative: '', contact_email: '' });
      setShowForm(false);
      fetchData();

    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
  };

  // --- Eliminar (Soft Delete o Hard Delete según prefieras) ---
  const handleDelete = async (id) => {
    if(!window.confirm("¿Eliminar esta empresa? Esto podría afectar a empleados vinculados.")) return;
    
    try {
        const { error } = await supabase.from('rrhh_subcontractors').delete().eq('id', id);
        if (error) throw error;
        fetchData();
    } catch (error) {
        alert("No se puede eliminar: Probablemente tiene empleados asociados.");
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando empresas...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Empresas Contratistas</h2>
            <p className="text-slate-500 mt-1">Gestión de empresas externas y subcontratos.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium">
                ⬅ Volver
            </button>
            <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium shadow-sm">
                {showForm ? 'Cancelar' : '+ Nueva Empresa'}
            </button>
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
            <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-slate-200 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-slate-800">Datos de la Empresa Externa</h3>
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-700 mb-1">RUT Empresa</label>
                        <input required className="w-full border p-2 rounded" placeholder="76.xxx.xxx-x" 
                            value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Razón Social</label>
                        <input required className="w-full border p-2 rounded" placeholder="Constructora Ejemplo SpA" 
                            value={formData.business_name} onChange={e => setFormData({...formData, business_name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Representante Legal</label>
                        <input className="w-full border p-2 rounded" placeholder="Nombre Completo" 
                            value={formData.legal_representative} onChange={e => setFormData({...formData, legal_representative: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Email Contacto</label>
                        <input type="email" className="w-full border p-2 rounded" placeholder="contacto@empresa.cl" 
                            value={formData.contact_email} onChange={e => setFormData({...formData, contact_email: e.target.value})} />
                    </div>
                    <div className="md:col-span-2 pt-2">
                        <button type="submit" className="w-full bg-slate-900 text-white p-2 rounded hover:bg-slate-800 font-medium">
                            Guardar Contratista
                        </button>
                    </div>
                </form>
            </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b">
                    <tr>
                        <th className="p-4">Razón Social</th>
                        <th className="p-4">RUT</th>
                        <th className="p-4">Contacto</th>
                        <th className="p-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {subs.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-slate-400">No hay subcontratistas registrados.</td></tr>
                    ) : (
                        subs.map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-50">
                                <td className="p-4 font-medium text-slate-900">{sub.business_name}</td>
                                <td className="p-4 text-slate-600">{sub.rut}</td>
                                <td className="p-4 text-slate-600 text-sm">
                                    {sub.legal_representative}<br/>
                                    <span className="text-slate-400">{sub.contact_email}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => handleDelete(sub.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                                        Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

      </div>
    </div>
  );
};

export default SubcontractorSettings;