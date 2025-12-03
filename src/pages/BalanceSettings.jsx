import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const BalanceSettings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null); // ID del empleado que se está editando
    const [editData, setEditData] = useState({}); // Datos temporales de edición

    // --- Lógica de Carga de Datos ---

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            
            // 1. Cargar todos los empleados
            const { data: empData } = await supabase
                .from('rrhh_employees')
                .select(`
                    id, 
                    first_name, 
                    last_name, 
                    organization_id, 
                    balance:rrhh_vacation_balances(id, annual_days, balance_days)
                `)
                .order('last_name', { ascending: true });

            // Mapeamos los datos para aplanar el objeto de balance
            const mappedEmployees = empData.map(emp => ({
                ...emp,
                balance_entry: emp.balance?.[0] || null, // El balance puede ser null si no se ha creado
                annual_days: emp.balance?.[0]?.annual_days || 15, // Default 15
                balance_days: emp.balance?.[0]?.balance_days || 0,
            }));

            setEmployees(mappedEmployees || []);

        } catch (error) {
            console.error("Error fetching data:", error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) fetchData();
    }, [user, fetchData]);


    // --- Lógica de Edición y Guardado ---

    const handleSaveBalance = async (employee) => {
        // 1. OBTENEMOS la clave primaria de la fila de balance existente del objeto original
        const balanceId = employee.balance_entry?.id; 

        try {
            setLoading(true);

            const payload = {
                annual_days: editData.annual_days,
                balance_days: editData.balance_days,
                last_reset_date: new Date().toISOString().split('T')[0], // Actualizar la fecha
            };

            if (balanceId) {
                // RUTA CORRECTA: UPDATE (La fila ya existe, la actualizamos)
                const { error } = await supabase
                    .from('rrhh_vacation_balances')
                    .update(payload)
                    .eq('id', balanceId); // <--- Usamos el ID de la fila de balance, no el ID del empleado
                if (error) throw error;
            } else {
                // RUTA DE INSERCIÓN (Si el empleado nunca ha tenido una fila de balance)
                // Esta ruta debería ser tomada solo la primera vez.
                const { error } = await supabase
                    .from('rrhh_vacation_balances')
                    .insert({
                        ...payload,
                        employee_id: employee.id, // Añadimos la clave foránea
                        organization_id: employee.organization_id,
                    });
                if (error) throw error;
            }

            alert(`Balance de ${employee.first_name} guardado con éxito.`);
            setEditingId(null);
            fetchData(); 

        } catch (error) {
            alert(`Error al guardar balance: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    // --- Renderización ---

    const handleOpenEdit = (employee) => {
        setEditingId(employee.id);
        // Cargar los datos actuales en el estado temporal
        setEditData({
            organization_id: employee.organization_id,
            annual_days: employee.annual_days,
            balance_days: employee.balance_days,
            balance_entry: employee.balance_entry
        });
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando Saldos...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                
                {/* Encabezado */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Gestión de Saldos (Vacaciones)</h2>
                        <p className="text-gray-500 mt-1">Asignación inicial y ajustes manuales por empleado.</p>
                    </div>
                    <button 
                        onClick={() => navigate('/')} 
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors shadow-sm font-medium"
                    >
                        ⬅ Volver a Empleados
                    </button>
                </div>

                {/* Tabla de Saldos */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-100 border-b text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                <th className="px-6 py-3">Empleado</th>
                                <th className="px-6 py-3 text-center">Asignación Anual</th>
                                <th className="px-6 py-3 text-center">Saldo Disponible</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.length === 0 ? (
                                <tr><td colSpan="4" className="p-10 text-center text-gray-400">No hay empleados registrados.</td></tr>
                            ) : (
                                employees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {emp.first_name} {emp.last_name}
                                        </td>
                                        
                                        {/* Campos Editables */}
                                        <td className="px-6 py-2 text-center">
                                            {editingId === emp.id ? (
                                                <input 
                                                    type="number" 
                                                    value={editData.annual_days}
                                                    onChange={(e) => setEditData({...editData, annual_days: Number(e.target.value)})}
                                                    className="w-20 border text-center p-1 rounded"
                                                />
                                            ) : (
                                                <span className="text-gray-700">{emp.annual_days} días</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-2 text-center">
                                            {editingId === emp.id ? (
                                                <input 
                                                    type="number" 
                                                    value={editData.balance_days}
                                                    onChange={(e) => setEditData({...editData, balance_days: Number(e.target.value)})}
                                                    className="w-20 border text-center p-1 rounded"
                                                />
                                            ) : (
                                                <span className={`font-bold ${emp.balance_days < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    {emp.balance_days} días
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* Botones de Acción */}
                                        <td className="px-6 py-4 text-right">
                                            {editingId === emp.id ? (
                                                <div className="flex gap-2 justify-end">
                                                    <button 
                                                        onClick={() => handleSaveBalance(emp)}
                                                        className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                                                    >
                                                        Guardar
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingId(null)}
                                                        className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded hover:bg-gray-300 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => handleOpenEdit(emp)}
                                                    className="bg-yellow-50 text-yellow-700 text-xs px-3 py-1 rounded hover:bg-yellow-100 transition-colors"
                                                >
                                                    Ajustar Saldo
                                                </button>
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
    );
};

export default BalanceSettings;