import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PayslipPDF from '../components/PayslipPDF';
import MassivePayslipPDF from '../components/MassivePayslipPDF';

// --- COMPONENTE SELECTOR (Igual que antes) ---
const ConceptSelector = ({ concepts, selectedCode, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const selectedItem = concepts.find(c => c.code === selectedCode);
    const filtered = concepts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search));

    return (
        <div className="relative" ref={wrapperRef}>
            <label className="text-xs font-bold text-indigo-600 mb-1 block">Concepto (Buscar)</label>
            <div className="w-full border-2 border-indigo-100 p-2 rounded text-sm bg-white flex justify-between items-center cursor-text" onClick={() => setIsOpen(true)}>
                {isOpen ? (
                    <input autoFocus className="w-full outline-none" placeholder="Escribe..." value={search} onChange={e => setSearch(e.target.value)} />
                ) : (
                    <span className={selectedItem ? 'text-slate-800' : 'text-slate-400'}>{selectedItem ? `${selectedItem.name}` : '-- Seleccione --'}</span>
                )}
                <span className="text-xs text-slate-400">▼</span>
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full bg-white border border-slate-200 shadow-xl max-h-60 overflow-y-auto rounded-b-lg mt-1">
                    {filtered.map(c => (
                        <div key={c.id} onClick={() => { onSelect(c.code); setIsOpen(false); setSearch(''); }} className="p-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0">
                            <div className="text-sm font-medium text-slate-700">{c.name}</div>
                            <div className="flex justify-between items-center mt-1">
                                <span className={`text-[9px] px-1.5 rounded border ${c.type === 'HABER' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{c.type}</span>
                                <span className="text-[10px] text-slate-400 font-mono">Cod: {c.code}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const PayrollGenerator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [lreConcepts, setLreConcepts] = useState([]); 
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [indicators, setIndicators] = useState(null); 
  const [employeeData, setEmployeeData] = useState(null); 
  
  const [isSaved, setIsSaved] = useState(false);
  const [currentPayrollId, setCurrentPayrollId] = useState(null); // Para saber cuál editar
  const [bulkPayrolls, setBulkPayrolls] = useState([]);
  const [readyToDownloadBulk, setReadyToDownloadBulk] = useState(false);

  const [extraItems, setExtraItems] = useState([]);
  const [newItem, setNewItem] = useState({ amount: '', lre_code: '' });

  const [calculated, setCalculated] = useState({
      sueldoBase: 0, diasTrabajados: 30, gratificacion: 0, 
      totalImponible: 0, colacionMovil: 0, totalHaberes: 0,
      afpAmount: 0, saludAmount: 0, cesantiaAmount: 0,
      totalDescuentosLegales: 0, totalOtrosDescuentos: 0, totalDescuentos: 0, 
      sueldoLiquido: 0, tasaAFPUsada: 0
  });

  useEffect(() => {
      const init = async () => {
          const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
          if (profile) {
              const empData = await supabase.from('rrhh_employees').select('id, first_name, last_name, rut').eq('organization_id', profile.organization_id);
              setEmployees(empData.data || []);
              const lreData = await supabase.from('rrhh_lre_concepts').select('*').order('name');
              setLreConcepts(lreData.data || []);
          }
      };
      if (user) init();
  }, [user]);

  useEffect(() => {
      const loadIndicators = async () => {
          const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
          if (!profile) return;
          const { data } = await supabase.from('rrhh_payroll_parameters').select('*').eq('organization_id', profile.organization_id).eq('period_date', `${selectedMonth}-01`).single();
          setIndicators(data || null);
      };
      loadIndicators();
  }, [selectedMonth, user]);

  useEffect(() => {
      if (!selectedEmployeeId) return;
      const loadEmployeeData = async () => {
          setIsSaved(false);
          setCurrentPayrollId(null);
          const { data } = await supabase.from('rrhh_employees').select('*, pension:pension_provider_id(name, rate), health:health_provider_id(name), job:job_id(name)').eq('id', selectedEmployeeId).single();
          setEmployeeData(data);
          
          const { data: existing } = await supabase.from('rrhh_payrolls').select('id, is_closed').eq('employee_id', selectedEmployeeId).eq('period_date', `${selectedMonth}-01`).single();
          if (existing) {
               setCurrentPayrollId(existing.id);
               const { data: items } = await supabase.from('rrhh_payroll_items').select('*').eq('payroll_id', existing.id);
               const manualItems = items.filter(i => !['Sueldo Base', 'Gratificación Legal', 'AFP', 'Salud', 'Seguro Cesantía'].some(sys => i.concept.includes(sys))).map(i => ({
                   name: i.concept, amount: i.amount, type: i.category, lre_code: i.lre_code
               }));
               setExtraItems(manualItems);
               if(existing.is_closed) setIsSaved(true);
          } else {
              setExtraItems([]);
          }
      };
      loadEmployeeData();
  }, [selectedEmployeeId, selectedMonth]);

  useEffect(() => {
      if (!employeeData || !indicators) return;

      const diasTrabajados = 30; 
      const sueldoBaseContractual = Number(employeeData.salary) || 0;
      const sueldoBase = Math.round((sueldoBaseContractual / 30) * diasTrabajados);
      
      const topeGratificacion = (4.75 * indicators.min_wage) / 12;
      const gratificacionTeorica = sueldoBase * 0.25;
      const gratificacion = Math.min(gratificacionTeorica, topeGratificacion);

      const bonosImponibles = extraItems.filter(i => i.type === 'HABER_IMP').reduce((sum, i) => sum + Number(i.amount), 0);
      const totalImponible = sueldoBase + gratificacion + bonosImponibles;

      const tasaAFP = (employeeData.pension?.rate || 10) / 100;
      const tasaSalud = 0.07;
      const tasaCesantia = 0.006; 
      const topeImponiblePesos = indicators.top_limit_afp * indicators.uf_value;
      const baseCalculoSeguridad = Math.min(totalImponible, topeImponiblePesos);

      const afpAmount = Math.round(baseCalculoSeguridad * tasaAFP);
      const saludAmount = Math.round(baseCalculoSeguridad * tasaSalud);
      const cesantiaAmount = Math.round(baseCalculoSeguridad * tasaCesantia);
      const totalDescuentosLegales = afpAmount + saludAmount + cesantiaAmount;

      const otrosDescuentos = extraItems.filter(i => i.type === 'DESC').reduce((sum, i) => sum + Number(i.amount), 0);
      const noImponibles = extraItems.filter(i => i.type === 'NO_IMP').reduce((sum, i) => sum + Number(i.amount), 0);
      const sueldoLiquido = (totalImponible + noImponibles) - (totalDescuentosLegales + otrosDescuentos);

      setCalculated({
          sueldoBase, diasTrabajados, gratificacion: Math.round(gratificacion), totalImponible: Math.round(totalImponible),
          colacionMovil: noImponibles, totalHaberes: totalImponible + noImponibles,
          afpAmount, saludAmount, cesantiaAmount, totalDescuentosLegales, 
          totalOtrosDescuentos: otrosDescuentos, totalDescuentos: totalDescuentosLegales + otrosDescuentos,
          sueldoLiquido: Math.round(sueldoLiquido), tasaAFPUsada: employeeData.pension?.rate || 10
      });
  }, [employeeData, indicators, extraItems]);

  const handleAddItem = (e) => {
      e.preventDefault();
      if (!newItem.lre_code || !newItem.amount) return;
      const concept = lreConcepts.find(c => c.code === newItem.lre_code);
      if (!concept) return;
      let internalType = 'HABER_IMP';
      if (concept.code.startsWith('2')) internalType = 'NO_IMP'; 
      if (concept.code.startsWith('3')) internalType = 'DESC';   
      setExtraItems([...extraItems, { name: concept.name, amount: newItem.amount, type: internalType, lre_code: newItem.lre_code }]);
      setNewItem({ lre_code: '', amount: '' });
  };

  const handleDeleteItem = (index) => {
      const newItems = [...extraItems];
      newItems.splice(index, 1);
      setExtraItems(newItems);
  };

  const handleSavePayroll = async () => {
      setLoading(true);
      try {
          const { data: payroll, error: payrollError } = await supabase.from('rrhh_payrolls')
            .upsert({
              organization_id: employeeData.organization_id,
              employee_id: employeeData.id,
              period_date: `${selectedMonth}-01`,
              total_imponible: calculated.totalImponible,
              total_no_imponible: calculated.colacionMovil,
              total_descuentos_legales: calculated.totalDescuentosLegales,
              total_otros_descuentos: calculated.totalOtrosDescuentos,
              sueldo_liquido: calculated.sueldoLiquido,
              is_closed: true
            }, { onConflict: 'employee_id, period_date' }).select().single();

          if (payrollError) throw payrollError;
          await supabase.from('rrhh_payroll_items').delete().eq('payroll_id', payroll.id);

          const systemItems = [
              { concept: 'Sueldo Base', amount: calculated.sueldoBase, category: 'HABER_IMP', lre_code: '1101' },
              { concept: 'Gratificación Legal', amount: calculated.gratificacion, category: 'HABER_IMP', lre_code: '1105' },
              { concept: `AFP ${employeeData.pension?.name}`, amount: calculated.afpAmount, category: 'DESCUENTO_LEGAL', lre_code: '3101' },
              { concept: `Salud ${employeeData.health?.name}`, amount: calculated.saludAmount, category: 'DESCUENTO_LEGAL', lre_code: '3102' },
              { concept: 'Seguro Cesantía', amount: calculated.cesantiaAmount, category: 'DESCUENTO_LEGAL', lre_code: '3104' }
          ];

          const manualItems = extraItems.map(item => ({
              payroll_id: payroll.id, concept: item.name, category: item.type, amount: item.amount, lre_code: item.lre_code
          }));

          const allItems = [...systemItems.map(i => ({ ...i, payroll_id: payroll.id })), ...manualItems];
          const { error: itemsError } = await supabase.from('rrhh_payroll_items').insert(allItems);
          if (itemsError) throw itemsError;
          
          alert("Liquidación guardada."); 
          setIsSaved(true);
          setCurrentPayrollId(payroll.id);

      } catch (error) { alert("Error: " + error.message); } finally { setLoading(false); }
  };

  // --- NUEVA FUNCIÓN: REABRIR PARA EDITAR ---
  const handleReopen = async () => {
      if (!currentPayrollId) return;
      if(!window.confirm("¿Reabrir liquidación? Se marcará como borrador.")) return;
      
      try {
          const { error } = await supabase.from('rrhh_payrolls')
            .update({ is_closed: false })
            .eq('id', currentPayrollId);

          if (error) throw error;
          setIsSaved(false);
          alert("Liquidación reabierta. Puedes editar.");
      } catch (error) {
          alert("Error: " + error.message);
      }
  };


  const prepareBulkDownload = async () => {
    setLoading(true); setReadyToDownloadBulk(false);
    try {
         const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
         const { data, error } = await supabase.from('rrhh_payrolls').select(`*, employee:employee_id(*, job:job_id(name), pension:pension_provider_id(name), health:health_provider_id(name)), items:rrhh_payroll_items(*)`).eq('organization_id', profile.organization_id).eq('period_date', `${selectedMonth}-01`).eq('is_closed', true);
         if (error) throw error;
         if (!data || data.length === 0) { alert("No hay liquidaciones cerradas."); return; }
         setBulkPayrolls(data); setReadyToDownloadBulk(true);
    } catch (error) { alert("Error: " + error.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Generador de Liquidaciones</h2>
            <div className="flex gap-2">
                 {!readyToDownloadBulk ? (
                    <button onClick={prepareBulkDownload} className="px-4 py-2 bg-slate-800 text-white border border-slate-900 rounded-lg hover:bg-slate-900 text-sm font-bold shadow-sm flex items-center gap-2">🖨️ Preparar Impresión Masiva</button>
                ) : (
                    <PDFDownloadLink document={<MassivePayslipPDF payrolls={bulkPayrolls} period={selectedMonth} />} fileName={`Nomina_${selectedMonth}.pdf`} className="px-4 py-2 bg-red-600 text-white border border-red-700 rounded-lg hover:bg-red-700 text-sm font-bold shadow-sm flex items-center gap-2">
                        {({ loading }) => loading ? 'Generando...' : '⬇ Descargar PDF Masivo'}
                    </PDFDownloadLink>
                )}
                <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border rounded text-slate-600">Volver</button>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-slate-500 mb-1">PERIODO</label><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full border p-2 rounded" /></div>
            <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">EMPLEADO</label><select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full border p-2 rounded"><option value="">-- Seleccionar --</option>{employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.rut})</option>)}</select></div>
        </div>

        {!indicators && <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 text-yellow-700">⚠️ Faltan parámetros económicos.</div>}

        {employeeData && indicators && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* PANEL IZQUIERDO (Solo visible si no está guardado) */}
                <div className={`lg:col-span-5 space-y-6 ${isSaved ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <div className="bg-white p-5 rounded-xl shadow-sm border h-full">
                        <h3 className="font-bold text-slate-700 mb-3 border-b pb-2">Movimientos del Mes</h3>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <ConceptSelector selectedCode={newItem.lre_code} concepts={lreConcepts} onSelect={(code) => setNewItem(prev => ({...prev, lre_code: code}))} />
                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Monto ($)</label><input type="number" placeholder="$" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})} className="w-full border p-2 rounded text-sm" required /></div>
                            <button className="w-full bg-slate-800 text-white py-2.5 rounded text-sm font-medium hover:bg-slate-900 shadow-sm">+ Agregar</button>
                        </form>
                        <ul className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                            {extraItems.map((item, idx) => (
                                <li key={idx} className="flex justify-between text-sm border-b pb-1">
                                    <div><span className="block font-medium">{item.name}</span><span className="text-[10px] text-gray-400">LRE: {item.lre_code}</span></div>
                                    <div className="flex gap-2"><span className="font-mono">${Number(item.amount).toLocaleString()}</span><button onClick={() => handleDeleteItem(idx)} className="text-red-400 font-bold">×</button></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* PANEL DERECHO */}
                <div className="lg:col-span-7">
                    <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                        <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Vista Previa</h3>
                            {isSaved && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">CERRADA</span>}
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                            {/* ... (Vista Previa de Haberes y Descuentos igual que antes) ... */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Haberes</h4>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span>Sueldo Base ({calculated.diasTrabajados} días)</span><span className="font-mono">${calculated.sueldoBase.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Gratificación</span><span className="font-mono">${calculated.gratificacion.toLocaleString()}</span></div>
                                    {extraItems.filter(i => i.type === 'HABER_IMP').map((i, idx) => (<div key={idx} className="flex justify-between text-blue-600"><span>{i.name}</span><span className="font-mono">${Number(i.amount).toLocaleString()}</span></div>))}
                                    <div className="flex justify-between border-t pt-1 font-bold text-slate-700 bg-slate-50 px-1"><span>Total Imponible</span><span>${calculated.totalImponible.toLocaleString()}</span></div>
                                </div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mt-6">No Imponibles</h4>
                                <div className="space-y-1">
                                    {extraItems.filter(i => i.type === 'NO_IMP').map((i, idx) => (<div key={idx} className="flex justify-between text-green-600"><span>{i.name}</span><span className="font-mono">${Number(i.amount).toLocaleString()}</span></div>))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Descuentos Legales</h4>
                                <div className="space-y-1 text-slate-600">
                                    <div className="flex justify-between"><span>AFP {employeeData.pension?.name} ({calculated.tasaAFPUsada}%)</span><span className="font-mono">${calculated.afpAmount.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Salud ({employeeData.health?.name})</span><span className="font-mono">${calculated.saludAmount.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Cesantía</span><span className="font-mono">${calculated.cesantiaAmount.toLocaleString()}</span></div>
                                </div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mt-6">Otros Descuentos</h4>
                                <div className="space-y-1 text-red-600">
                                    {extraItems.filter(i => i.type === 'DESC').map((i, idx) => (<div key={idx} className="flex justify-between"><span>{i.name}</span><span className="font-mono">${Number(i.amount).toLocaleString()}</span></div>))}
                                    <div className="flex justify-between border-t pt-1 font-bold text-red-800 bg-red-50 px-1 mt-2"><span>Total Descuentos</span><span>${calculated.totalDescuentos.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900 text-white p-5 flex justify-between items-center text-xl font-bold shadow-inner">
                            <span className="uppercase text-sm tracking-widest text-slate-400">Sueldo Líquido</span>
                            <span className="text-3xl">${calculated.sueldoLiquido.toLocaleString()}</span>
                        </div>
                        
                        {/* --- BARRA DE ACCIONES (EDITAR / PDF / GUARDAR) --- */}
                        <div className="p-4 bg-gray-50 border-t text-right flex justify-end gap-2">
                            {!isSaved ? (
                                <button onClick={handleSavePayroll} disabled={loading} className="bg-emerald-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-emerald-700">{loading ? '...' : '💾 Guardar'}</button>
                            ) : (
                                <>
                                    <button 
                                        onClick={handleReopen} 
                                        className="bg-amber-500 text-white px-4 py-2 rounded font-bold shadow hover:bg-amber-600 flex items-center gap-2"
                                    >
                                        ✏️ Editar / Reabrir
                                    </button>
                                    
                                    <PDFDownloadLink document={<PayslipPDF employee={employeeData} data={{...calculated, extraItems}} period={selectedMonth} />} fileName={`Liquidacion_${employeeData.rut}.pdf`} className="bg-red-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-red-700 flex items-center gap-2">
                                        {({ loading }) => loading ? '...' : '📄 PDF'}
                                    </PDFDownloadLink>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PayrollGenerator;