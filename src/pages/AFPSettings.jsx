import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

const AFPSettings = () => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para Edición
  const [editingId, setEditingId] = useState(null);
  const [tempRate, setTempRate] = useState(0);

  // Estados para Creación
  const [showCreate, setShowCreate] = useState(false);
  const [newAFP, setNewAFP] = useState({ name: '', rate: 10.0 });

  // Cargar AFPs
  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rrhh_pension_providers')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  // Guardar Edición (Tasa)
  const handleUpdate = async (id) => {
      try {
          const { error } = await supabase.from('rrhh_pension_providers').update({ rate: tempRate }).eq('id', id);
          if (error) throw error;
          setEditingId(null);
          fetchProviders();
          alert("Tasa actualizada.");
      } catch (error) { alert("Error al actualizar: " + error.message); }
  };

  // Crear Nueva AFP
  const handleCreate = async (e) => {
      e.preventDefault();
      if (!newAFP.name) return;
      try {
          const { error } = await supabase.from('rrhh_pension_providers').insert({
              name: newAFP.name,
              rate: newAFP.rate
          });
          if (error) throw error;
          
          alert("Nueva AFP agregada exitosamente.");
          setNewAFP({ name: '', rate: 10.0 });
          setShowCreate(false);
          fetchProviders();
      } catch (error) {
          alert("Error al crear: " + error.message);
      }
  };

  // Eliminar AFP
  const handleDelete = async (id) => {
      if (!window.confirm("¿Seguro que deseas eliminar esta AFP? Si hay empleados asignados, podría dar error.")) return;
      try {
          const { error } = await supabase.from('rrhh_pension_providers').delete().eq('id', id);
          if (error) throw error;
          fetchProviders();
      } catch (error) {
          alert("No se puede eliminar: Probablemente hay empleados usando esta AFP.");
      }
  };

  const startEdit = (provider) => {
      setEditingId(provider.id);
      setTempRate(provider.rate);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-3xl font-bold text-slate-900">Instituciones Previsionales (AFP)</h2>
                <p className="text-slate-500 mt-1">Mantenedor de AFPs y tasas vigentes.</p>
            </div>
            <div className="flex gap-2">
                <a 
                    href="https://www.previred.com/indicadores-previsionales/" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg font-medium hover:bg-blue-100 text-sm flex items-center gap-2"
                >
                    🔗 Ver Valores en Previred
                </a>
                {/* BOTÓN CORREGIDO: Ahora lleva a la raíz (Gestión de Personal) */}
                <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">
                    Volver a Personal
                </button>
            </div>
        </div>

        {/* Formulario de Creación */}
        {showCreate ? (
            <div className="bg-white p-6 rounded-xl shadow-md mb-6 border border-indigo-100 animate-fade-in">
                <h3 className="font-bold text-slate-700 mb-4">Registrar Nueva Institución</h3>
                <form onSubmit={handleCreate} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Nombre AFP</label>
                        <input 
                            type="text" 
                            placeholder="Ej: AFP Modelo" 
                            value={newAFP.name} 
                            onChange={e => setNewAFP({...newAFP, name: e.target.value})}
                            className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Tasa Total (%)</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            value={newAFP.rate} 
                            onChange={e => setNewAFP({...newAFP, rate: parseFloat(e.target.value)})}
                            className="w-full border p-2 rounded text-sm text-center"
                            required
                        />
                    </div>
                    <button className="bg-slate-800 text-white px-6 py-2 rounded text-sm font-bold hover:bg-slate-900 h-[38px]">
                        Guardar
                    </button>
                </form>
                <button onClick={() => setShowCreate(false)} className="mt-2 text-xs text-red-500 underline">Cancelar</button>
            </div>
        ) : (
            <div className="mb-6 text-right">
                <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm shadow-sm">
                    + Nueva AFP
                </button>
            </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-500">
                    <tr>
                        <th className="p-4">Institución</th>
                        <th className="p-4 text-center">Tasa Total (%)</th>
                        <th className="p-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading && <tr><td colSpan="3" className="p-8 text-center text-slate-400">Cargando...</td></tr>}
                    
                    {providers.map(afp => (
                        <tr key={afp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium text-slate-900">{afp.name}</td>
                            <td className="p-4 text-center">
                                {editingId === afp.id ? (
                                    <div className="flex justify-center">
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={tempRate}
                                            onChange={(e) => setTempRate(e.target.value)}
                                            className="border p-1 rounded w-20 text-center font-mono bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700 font-bold text-xs">
                                        {afp.rate}%
                                    </span>
                                )}
                            </td>
                            <td className="p-4 text-right flex justify-end gap-3 items-center">
                                {editingId === afp.id ? (
                                    <>
                                        <button onClick={() => handleUpdate(afp.id)} className="text-emerald-600 font-bold hover:underline text-xs">Guardar</button>
                                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 text-xs">Cancelar</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEdit(afp)} className="text-blue-600 font-medium hover:underline text-xs">
                                            Editar Tasa
                                        </button>
                                        <button onClick={() => handleDelete(afp.id)} className="text-red-400 hover:text-red-600 text-xs" title="Eliminar">
                                            🗑️
                                        </button>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="p-4 bg-slate-50 text-xs text-slate-500 text-center border-t">
                * La tasa debe incluir el 10% obligatorio + la comisión de la AFP.
            </div>
        </div>

      </div>
    </div>
  );
};

export default AFPSettings;