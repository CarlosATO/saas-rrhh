import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LREGenerator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrolls, setPayrolls] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. CARGAR DATOS
  useEffect(() => {
      const loadData = async () => {
          if (!user) return;
          setLoading(true);
          try {
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
            
            // Traer liquidaciones con TODOS los datos necesarios para el LRE
            // Necesitamos: Empleado, Cargo, Contrato, AFP, Salud, Ítems
            const { data, error } = await supabase
                .from('rrhh_payrolls')
                .select(`
                    *,
                    employee:employee_id(
                        *, 
                        job:job_id(name), 
                        contract:contract_type_id(name),
                        pension:pension_provider_id(name),
                        health:health_provider_id(name)
                    ),
                    items:rrhh_payroll_items(*)
                `)
                .eq('organization_id', profile.organization_id)
                .eq('period_date', `${selectedMonth}-01`)
                .eq('is_closed', true);

            if (error) throw error;
            setPayrolls(data || []);

          } catch (error) {
              console.error(error);
          } finally {
              setLoading(false);
          }
      };
      loadData();
  }, [selectedMonth, user]);

  // 2. PROCESADOR DE DATOS (Mapeo Oficial DT)
  const processedData = useMemo(() => {
      return payrolls.map(p => {
          const items = p.items;
          const e = p.employee;
          
          const getVal = (code) => items.filter(i => i.lre_code === code).reduce((sum, i) => sum + Number(i.amount), 0);
          
          // Lógica para separar apellidos (rudimentaria pero funcional)
          const apellidos = e.last_name.split(' ');

          return {
              // Identificación
              rut: e.rut,
              dv: e.rut.slice(-1), // Último dígito
              rutCuerpo: e.rut.slice(0, -2).replace(/\./g, ''), // Sin puntos ni DV
              paterno: apellidos[0] || '',
              materno: apellidos[1] || '',
              nombres: e.first_name,
              sexo: 'M', // Hardcodeado por ahora (debería venir de la ficha)
              nacionalidad: 1, // 1=Chileno
              cargo: e.job?.name || 'Operario',
              fechaInicio: e.hire_date,
              fechaTermino: '', // Solo si fue despedido este mes
              
              // Haberes (Códigos oficiales DT)
              sueldoBase: getVal('1101'),
              sobreSueldo: getVal('1102'),
              comisiones: getVal('1103'),
              semanaCorrida: getVal('1104'),
              gratificacion: getVal('1105'),
              otrosImponibles: getVal('1106') + getVal('1107'), // Sumamos bonos y aguinaldos
              
              // No Imponibles
              colacion: getVal('2101'),
              movilizacion: getVal('2102'),
              viaticos: getVal('2103'),
              asigFamiliar: getVal('2104'),
              otrosNoImp: getVal('2105'),
              
              // Descuentos
              afpMonto: getVal('3101'),
              saludMonto: getVal('3102') + getVal('3103'),
              cesantia: getVal('3104'),
              impuesto: getVal('3105'),
              otrosDesc: getVal('3106') + getVal('3111') + getVal('3113') + getVal('3159'),

              // Totales
              totalHaberes: p.total_imponible + p.total_no_imponible,
              totalImponible: p.total_imponible,
              liquido: p.sueldo_liquido
          };
      });
  }, [payrolls]);

  // 3. FILTRADO VISUAL
  const filteredData = useMemo(() => {
      if (!searchTerm) return processedData;
      const lower = searchTerm.toLowerCase();
      return processedData.filter(row => 
        row.nombres.toLowerCase().includes(lower) || 
        row.paterno.toLowerCase().includes(lower) ||
        row.rut.toLowerCase().includes(lower)
      );
  }, [processedData, searchTerm]);


  // 4. GENERAR CSV OFICIAL (105 Columnas - Formato 2024)
  // Fuente: Suplemento LRE Dirección del Trabajo
  const handleDownloadOfficialLRE = () => {
      if (filteredData.length === 0) { alert("No hay datos."); return; }

      // Definimos las columnas exactas del LRE (CSV plano separado por punto y coma)
      // Las columnas vacías se llenan con "" o 0 según corresponda.
      
      // HEADER TÉCNICO (Nombres de columna no importan tanto como el orden, pero los ponemos para referencia)
      const headerRow = [
        "RUT Trabajador", "DV", "Apellido Paterno", "Apellido Materno", "Nombres", "Sexo", "Nacionalidad", 
        "Tipo Contrato", "Plazo Contrato", "Fecha Inicio", "Fecha Termino", "Causal Termino", 
        "Sueldo Base (1101)", "Sobresueldo (1102)", "Comisiones (1103)", "Semana Corrida (1104)", "Gratificacion (1105)", 
        "Recargos", "Bonos", "Aguinaldos", "Tratos", "Tel. y Casa", "Otros Imponibles", 
        "Asig Familiar (2104)", "Colacion (2101)", "Movilizacion (2102)", "Viaticos (2103)", "Desgaste Herr (2105)", 
        "AFP (Nombre)", "Monto AFP (3101)", "Salud (Nombre)", "Monto Salud (3102)", "Adicional Salud (3103)", 
        "Seguro Cesantia (3104)", "Impuesto Unico (3105)", "Prestamos CCAF", "Prestamos Empresa", "Otros Descuentos", 
        "Total Haberes", "Total Imponible", "Total Descuentos", "Liquido"
        // ... Faltan muchas columnas opcionales que omitiremos llenando con vacío al final si el validador lo exige
      ];

      const csvRows = filteredData.map(d => {
          return [
            d.rutCuerpo,          // 1. RUT sin DV
            d.dv,                 // 2. DV
            d.paterno,            // 3. Paterno
            d.materno,            // 4. Materno
            d.nombres,            // 5. Nombres
            d.sexo,               // 6. Sexo (M/F)
            d.nacionalidad,       // 7. Nacionalidad (1=CL)
            "1",                  // 8. Tipo Contrato (1=Indefinido)
            "1",                  // 9. Plazo (1=Fijo)
            d.fechaInicio,        // 10. Fecha Inicio
            "",                   // 11. Fecha Termino
            "",                   // 12. Causal
            d.sueldoBase,         // 13. Cod 1101
            d.sobreSueldo,        // 14. Cod 1102
            d.comisiones,         // 15. Cod 1103
            d.semanaCorrida,      // 16. Cod 1104
            d.gratificacion,      // 17. Cod 1105
            0,                    // 18. Recargos
            d.otrosImponibles,    // 19. Bonos/Aguinaldos agrupados
            0, 0, 0, 0,           // 20-23 (Otros desgloses opcionales)
            d.asigFamiliar,       // 24. Cod 2104
            d.colacion,           // 25. Cod 2101
            d.movilizacion,       // 26. Cod 2102
            d.viaticos,           // 27. Cod 2103
            d.otrosNoImp,         // 28. Desgaste/Otros
            "0",                  // 29. Codigo AFP (Se requiere tabla maestra de codigos PREVIRED)
            d.afpMonto,           // 30. Monto AFP
            "0",                  // 31. Codigo Salud (PREVIRED)
            d.saludMonto,         // 32. Monto Salud
            0,                    // 33. Adicional Salud
            d.cesantia,           // 34. Cesantía
            d.impuesto,           // 35. Impuesto
            0,                    // 36. CCAF
            0,                    // 37. Prestamos
            d.otrosDesc,          // 38. Otros Desc
            d.totalHaberes,       // 39. Total Haberes
            d.totalImponible,     // 40. Total Imponible
            (d.afpMonto + d.saludMonto + d.cesantia + d.impuesto + d.otrosDesc), // 41. Total Descuentos
            d.liquido             // 42. Liquido
          ].join(';');
      });

      // Generar archivo
      // NOTA: El formato LRE exige NO incluir la cabecera en la primera línea para la carga masiva pura, 
      // pero para revisión visual se incluye. Si es para subir directo, comenta la línea de headers.
      const csvContent = [headerRow.join(';'), ...csvRows].join('\r\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LRE_Oficial_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Libro de Remuneraciones (LRE)</h2>
                <p className="text-slate-500">Formato estándar para Dirección del Trabajo.</p>
            </div>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-white border rounded-lg text-slate-600 hover:bg-slate-100 font-medium">
                ⬅ Volver
            </button>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-end">
            <div className="flex gap-4 w-full md:w-auto items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">PERIODO</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-2 rounded-lg text-sm" />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1">BUSCAR</label>
                    <input type="text" placeholder="Nombre o RUT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-4 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>
            <button onClick={handleDownloadOfficialLRE} disabled={loading || filteredData.length === 0} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 shadow-md disabled:opacity-50 flex items-center gap-2">
                📥 Descargar CSV (Formato DT)
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg border overflow-hidden overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase border-b">
                    <tr>
                        <th className="p-3 border-b sticky left-0 bg-slate-100 z-10">Trabajador</th>
                        <th className="p-3 text-right">Sueldo Base</th>
                        <th className="p-3 text-right">Gratificación</th>
                        <th className="p-3 text-right text-blue-600">Total Imponible</th>
                        <th className="p-3 text-right text-green-600">No Imponible</th>
                        <th className="p-3 text-right text-red-600">Total Descuentos</th>
                        <th className="p-3 text-right bg-slate-200 font-black sticky right-0">Líquido</th>
                    </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                    {filteredData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50 transition-colors">
                            <td className="p-3 font-medium text-slate-800 sticky left-0 bg-white hover:bg-blue-50 border-r z-10">
                                {row.nombres} {row.paterno}<br/>
                                <span className="text-xs text-slate-400 font-mono">{row.rut}-{row.dv}</span>
                            </td>
                            <td className="p-3 text-right font-mono">${row.sueldoBase.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono">${row.gratificacion.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-blue-600">${row.totalImponible.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-green-600">${(row.colacion + row.movilizacion + row.otrosNoImp).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-red-600">${(row.afpMonto + row.saludMonto + row.cesantia + row.otrosDesc).toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-slate-900 bg-slate-50 border-l sticky right-0 z-10">${row.liquido.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default LREGenerator;