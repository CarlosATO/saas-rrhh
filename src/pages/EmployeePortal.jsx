import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PayslipPDF from '../components/PayslipPDF';

const EmployeePortal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados de Datos
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [lastLog, setLastLog] = useState(null);
  
  // Estados de UI
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('clock'); 
  const [marking, setMarking] = useState(false);
  
  // Estados para Listas
  const [myLogs, setMyLogs] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [myPayrolls, setMyPayrolls] = useState([]); // <--- NUEVO: Lista de Liquidaciones
  const [absenceTypes, setAbsenceTypes] = useState([]);

  // Estado Formulario Solicitud
  const [reqForm, setReqForm] = useState({ type_id: '', start_date: '', end_date: '', reason: '' });

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 1. CARGA DE DATOS ---
  const fetchEmployeeStatus = useCallback(async () => {
    try {
      // Búsqueda robusta por User ID
      const { data: empData, error } = await supabase
        .from('rrhh_employees')
        .select('*, pension:pension_provider_id(name, rate), health:health_provider_id(name), job:job_id(name)')
        .eq('user_id', user.id)
        .single();

      if (error || !empData) {
        // Fallback por RUT
        if (user.email.endsWith('@sistema.local')) {
             const extractedRut = user.email.split('@')[0];
             const { data: retryData } = await supabase.from('rrhh_employees').select('*, pension:pension_provider_id(name, rate), health:health_provider_id(name), job:job_id(name)').eq('rut', extractedRut).single();
             if (retryData) {
                 setEmployee(retryData);
                 fetchDashboardData(retryData.id);
                 return;
             }
        }
        console.error("No se encontró ficha.");
      } else {
        setEmployee(empData);
        fetchDashboardData(empData.id);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [user]);

  const fetchDashboardData = async (empId) => {
      // 1. Última marca
      const { data: logs } = await supabase.from('rrhh_attendance_logs')
          .select('*').eq('employee_id', empId).order('timestamp', { ascending: false }).limit(1);
      if (logs?.[0]) setLastLog(logs[0]);

      // 2. Historial reciente
      const { data: history } = await supabase.from('rrhh_attendance_logs')
          .select('*').eq('employee_id', empId).order('timestamp', { ascending: false }).limit(10);
      setMyLogs(history || []);

      // 3. Solicitudes
      const { data: reqs } = await supabase.from('rrhh_employee_absences')
          .select(`*, type:type_id(name)`).eq('employee_id', empId).order('requested_at', { ascending: false });
      setMyRequests(reqs || []);

      // 4. Liquidaciones (NUEVO)
      // Traemos también los ítems para poder reconstruir el PDF
      const { data: payrolls } = await supabase.from('rrhh_payrolls')
          .select(`*, items:rrhh_payroll_items(*)`)
          .eq('employee_id', empId)
          .eq('is_closed', true) // Solo mostrar las cerradas/oficiales
          .order('period_date', { ascending: false });
      setMyPayrolls(payrolls || []);

      const { data: types } = await supabase.from('rrhh_absence_types').select('*');
      setAbsenceTypes(types || []);
  };

  useEffect(() => { if (user) fetchEmployeeStatus(); }, [user, fetchEmployeeStatus]);

  // --- Helper para reconstruir datos del PDF ---
  const getPdfData = (payroll) => {
      // Reconstruimos el objeto de datos que espera el componente PayslipPDF
      // usando los datos guardados en la liquidación histórica + datos base del empleado
      
      // Nota: Para un sistema histórico perfecto, deberíamos haber guardado todos estos valores
      // en la BD. Para este MVP, recalculamos los bases usando el sueldo actual (o el guardado si existiera).
      const extraItems = payroll.items.map(i => ({ name: i.concept, amount: i.amount, type: i.category }));
      
      // Estimamos valores base desde los totales guardados si es necesario, 
      // o usamos los del empleado actual como referencia visual.
      // Para el líquido y totales usamos los valores REALES guardados en la liquidación.
      
      return {
          sueldoBase: employee.salary, // Referencia
          gratificacion: 0, // Se calcularía o se sacaría de ítems si lo guardamos desglosado
          totalImponible: payroll.total_imponible,
          colacionMovil: payroll.total_no_imponible,
          
          // Desgloses visuales (Simulados con datos actuales para llenar el PDF, 
          // pero los totales son los reales de la BD)
          afpAmount: Math.round(payroll.total_imponible * ((employee.pension?.rate || 10)/100)), 
          saludAmount: Math.round(payroll.total_imponible * 0.07),
          cesantiaAmount: Math.round(payroll.total_imponible * 0.006),
          
          totalDescuentosLegales: payroll.total_descuentos_legales,
          totalOtrosDescuentos: payroll.total_otros_descuentos,
          totalDescuentos: payroll.total_descuentos_legales + payroll.total_otros_descuentos,
          sueldoLiquido: payroll.sueldo_liquido,
          
          extraItems: extraItems
      };
  };


  // --- ACCIONES ---

  const handleMark = async (type) => {
    setMarking(true);
    let location = { lat: null, long: null };
    if ("geolocation" in navigator) {
        try {
            const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 }));
            location.lat = position.coords.latitude;
            location.long = position.coords.longitude;
        } catch (e) { console.warn("GPS no disponible"); }
    }
    try {
        const { error } = await supabase.from('rrhh_attendance_logs').insert({
            employee_id: employee.id, organization_id: employee.organization_id,
            type: type, latitude: location.lat, longitude: location.long, device_info: navigator.userAgent
        });
        if (error) throw error;
        alert(`¡Marca de ${type === 'IN' ? 'ENTRADA' : 'SALIDA'} registrada!`);
        fetchDashboardData(employee.id); 
    } catch (error) { alert("Error: " + error.message); } finally { setMarking(false); }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/worker-login');
  };

  const handleSubmitRequest = async (e) => {
      e.preventDefault();
      if (!reqForm.type_id) return;
      try {
        const startDate = new Date(reqForm.start_date);
        const endDate = new Date(reqForm.end_date);
        const diffTime = Math.abs(endDate - startDate);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        const { error } = await supabase.from('rrhh_employee_absences').insert({
            employee_id: employee.id, organization_id: employee.organization_id,
            type_id: reqForm.type_id, start_date: reqForm.start_date, end_date: reqForm.end_date,
            total_days: totalDays, reason: reqForm.reason, status: 'pending'
        });
        if (error) throw error;
        alert("Solicitud enviada");
        setReqForm({ type_id: '', start_date: '', end_date: '', reason: '' });
        fetchDashboardData(employee.id);
      } catch (error) { alert(error.message); }
  };

  // --- RENDERIZADO ---

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white">Cargando...</div>;
  if (!employee) return <div className="p-10 text-center">No se encontró ficha de empleado.</div>;

  const isWorking = lastLog?.type === 'IN';

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative overflow-hidden font-sans">
        
        {/* BARRA SUPERIOR */}
        <div className="bg-slate-800 p-4 flex justify-between items-center shadow-md z-20">
            <div>
                <h1 className="font-bold text-lg">{employee.first_name} {employee.last_name}</h1>
                <p className="text-xs text-slate-400 uppercase">{employee.position || 'Colaborador'}</p>
            </div>
            <button onClick={handleLogout} className="bg-red-600/20 text-red-400 border border-red-600/50 px-3 py-1 rounded text-xs font-bold hover:bg-red-600 hover:text-white transition-colors">
                SALIR
            </button>
        </div>

        <div className="flex-grow overflow-y-auto pb-24 p-4">
            
            {/* VISTA 1: RELOJ */}
            {activeTab === 'clock' && (
                <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in">
                    <div className="text-center">
                        <div className="text-6xl font-bold tracking-tighter text-white drop-shadow-lg">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-slate-400 text-lg mt-1">{currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    </div>
                    <div className="flex gap-6 w-full max-w-md justify-center">
                        <button onClick={() => handleMark('IN')} disabled={isWorking || marking} className={`flex-1 py-8 rounded-2xl flex flex-col items-center transition-all transform active:scale-95 ${isWorking ? 'bg-slate-800 border-2 border-slate-700 opacity-50 cursor-not-allowed grayscale' : 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-b-4 border-emerald-900 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:brightness-110'}`}>
                            <span className="text-4xl mb-2">👋</span><span className="font-black text-xl tracking-wider">ENTRADA</span>
                        </button>
                        <button onClick={() => handleMark('OUT')} disabled={!isWorking || marking} className={`flex-1 py-8 rounded-2xl flex flex-col items-center transition-all transform active:scale-95 ${!isWorking ? 'bg-slate-800 border-2 border-slate-700 opacity-50 cursor-not-allowed grayscale' : 'bg-gradient-to-b from-rose-500 to-rose-700 border-b-4 border-rose-900 shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:brightness-110'}`}>
                            <span className="text-4xl mb-2">🏠</span><span className="font-black text-xl tracking-wider">SALIDA</span>
                        </button>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl text-center border border-slate-700 w-full max-w-md">
                        {lastLog ? <p className="text-sm">Última marca: <span className={isWorking ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{isWorking ? 'ENTRADA' : 'SALIDA'}</span> a las {new Date(lastLog.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p> : <p className="text-slate-400 text-sm">Sin marcas hoy</p>}
                    </div>
                </div>
            )}

            {/* VISTA 2: HISTORIAL */}
            {activeTab === 'history' && (
                <div className="max-w-md mx-auto animate-fade-in">
                    <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Mis Marcajes</h2>
                    <div className="space-y-3">
                        {myLogs.map(log => (
                            <div key={log.id} className="bg-slate-800 p-4 rounded-lg flex justify-between items-center border-l-4 border-slate-600">
                                <div><span className={`text-xs font-bold px-2 py-1 rounded ${log.type === 'IN' ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`}>{log.type === 'IN' ? 'ENTRADA' : 'SALIDA'}</span><div className="text-xs text-slate-400 mt-1">{new Date(log.timestamp).toLocaleDateString()}</div></div>
                                <div className="text-xl font-mono font-bold">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VISTA 3: SOLICITUDES */}
            {activeTab === 'requests' && (
                <div className="max-w-md mx-auto animate-fade-in">
                    <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Mis Solicitudes</h2>
                    <form onSubmit={handleSubmitRequest} className="bg-slate-800 p-4 rounded-xl space-y-3 mb-6 border border-slate-700 shadow-lg">
                        <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" value={reqForm.type_id} onChange={e => setReqForm({...reqForm, type_id: e.target.value})} required>
                            <option value="">Tipo...</option>{absenceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" value={reqForm.start_date} onChange={e => setReqForm({...reqForm, start_date: e.target.value})} required />
                            <input type="date" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" value={reqForm.end_date} onChange={e => setReqForm({...reqForm, end_date: e.target.value})} required />
                        </div>
                        <input type="text" placeholder="Motivo" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" value={reqForm.reason} onChange={e => setReqForm({...reqForm, reason: e.target.value})} />
                        <button className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold text-sm">ENVIAR</button>
                    </form>
                    <div className="space-y-2">
                        {myRequests.map(req => (
                            <div key={req.id} className="bg-slate-800/50 p-3 rounded border border-slate-700 flex justify-between items-center">
                                <div><div className="font-bold text-sm text-white">{req.type.name}</div><div className="text-xs text-slate-400">{req.start_date}</div></div>
                                <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${req.status === 'approved' ? 'bg-emerald-900 text-emerald-400' : 'bg-yellow-900 text-yellow-400'}`}>{req.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* VISTA 4: MIS PAGOS (NUEVA) */}
            {activeTab === 'payments' && (
                <div className="max-w-md mx-auto animate-fade-in">
                    <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Mis Liquidaciones</h2>
                    
                    {myPayrolls.length === 0 ? (
                        <div className="bg-slate-800/50 p-6 rounded-xl text-center border border-slate-700">
                            <p className="text-slate-400">Aún no tienes liquidaciones generadas.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myPayrolls.map(payroll => (
                                <div key={payroll.id} className="bg-slate-800 p-4 rounded-xl border-l-4 border-blue-500 shadow-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">
                                            {new Date(payroll.period_date + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                                        </p>
                                        <p className="text-2xl font-bold text-white">
                                            ${Number(payroll.sueldo_liquido).toLocaleString('es-CL')}
                                        </p>
                                        <p className="text-[10px] text-slate-400">Líquido a Pagar</p>
                                    </div>
                                    
                                    <div>
                                        <PDFDownloadLink 
                                            document={<PayslipPDF employee={employee} data={getPdfData(payroll)} period={payroll.period_date} />}
                                            fileName={`Liquidacion_${payroll.period_date}.pdf`}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                        >
                                            {({ loading }) => loading ? '⏳' : '⬇ PDF'}
                                        </PDFDownloadLink>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>

        {/* MENU INFERIOR (4 PESTAÑAS) */}
        <div className="fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 flex justify-between px-4 py-2 z-30 safe-area-bottom shadow-2xl">
            <button onClick={() => setActiveTab('clock')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'clock' ? 'text-blue-400' : 'text-slate-500'}`}>
                <span className="text-xl">⏱️</span><span className="text-[9px] font-bold mt-1">RELOJ</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'history' ? 'text-blue-400' : 'text-slate-500'}`}>
                <span className="text-xl">📋</span><span className="text-[9px] font-bold mt-1">HISTORIAL</span>
            </button>
            <button onClick={() => setActiveTab('requests')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'requests' ? 'text-blue-400' : 'text-slate-500'}`}>
                <span className="text-xl">✈️</span><span className="text-[9px] font-bold mt-1">PERMISOS</span>
            </button>
            <button onClick={() => setActiveTab('payments')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'payments' ? 'text-blue-400' : 'text-slate-500'}`}>
                <span className="text-xl">💰</span><span className="text-[9px] font-bold mt-1">PAGOS</span>
            </button>
        </div>

    </div>
  );
};

export default EmployeePortal;