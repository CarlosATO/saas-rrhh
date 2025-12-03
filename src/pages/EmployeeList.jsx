import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePendingRequests } from '../hooks/usePendingRequests';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- FUNCIÓN HELPER: Limpiar RUT ---
const cleanRut = (value) => {
    if (!value) return '';
    return value.replace(/\./g, '').trim().toLowerCase();
}

// --- FUNCIÓN HELPER: CREAR USUARIO AUTH ---
const createWorkerAuth = async (rut, pin, name) => {
    const tempClient = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    const fakeEmail = `${cleanRut(rut)}@sistema.local`;

    const { data, error } = await tempClient.auth.signUp({
        email: fakeEmail,
        password: pin,
        options: { data: { full_name: name } }
    });

    if (error) {
        console.warn("Advertencia Auth:", error.message);
        return false;
    }
    return true;
};


// --- COMPONENTE AUXILIAR 1: Acreditaciones ---
const EmployeeCertifications = ({ employeeId, organizationId, coursesMaster }) => {
    const [certs, setCerts] = useState([]);
    const [newCert, setNewCert] = useState({ course_id: '', issue_date: '', expiry_date: '' });
    const [certFile, setCertFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const fetchCerts = useCallback(async () => {
        if (!employeeId) return;
        const { data } = await supabase
            .from('rrhh_employee_certifications')
            .select(`*, course:course_id(name)`)
            .eq('employee_id', employeeId)
            .order('expiry_date', { ascending: true });
        setCerts(data || []);
    }, [employeeId]);

    useEffect(() => { fetchCerts(); }, [fetchCerts]);

    const getStatusColor = (expiryDate) => {
        const today = new Date();
        const expiry = new Date(expiryDate);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'bg-red-100 text-red-800 border-red-200';
        if (diffDays <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    };

    const handleSaveCert = async (e) => {
        e.preventDefault();
        if (!newCert.course_id || !certFile) return;
        setUploading(true);
        try {
            const fileExt = certFile.name.split('.').pop();
            const fileName = `${organizationId}/${employeeId}/cert_${newCert.course_id}_${Date.now()}.${fileExt}`;
            await supabase.storage.from('rrhh-files').upload(fileName, certFile);
            await supabase.from('rrhh_employee_certifications').insert({
                employee_id: employeeId, organization_id: organizationId,
                course_id: newCert.course_id, issue_date: newCert.issue_date,
                expiry_date: newCert.expiry_date, certificate_url: fileName
            });
            alert('Acreditación guardada'); setNewCert({ course_id: '', issue_date: '', expiry_date: '' }); setCertFile(null); fetchCerts();
        } catch (error) { alert(error.message); } finally { setUploading(false); }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                {certs.map(c => (
                    <div key={c.id} className={`p-3 rounded border text-sm flex justify-between ${getStatusColor(c.expiry_date)}`}>
                        <span>{c.course.name} (Vence: {c.expiry_date})</span>
                        {c.certificate_url && <a href={supabase.storage.from('rrhh-files').getPublicUrl(c.certificate_url).data.publicUrl} target="_blank" rel="noreferrer" className="underline">Ver</a>}
                    </div>
                ))}
            </div>
            <form onSubmit={handleSaveCert} className="bg-gray-50 p-4 rounded border space-y-3">
                <h4 className="text-sm font-bold">Nueva Acreditación</h4>
                <select className="w-full border p-2 rounded" value={newCert.course_id} onChange={e => setNewCert({...newCert, course_id: e.target.value})} required>
                    <option value="">Curso...</option>
                    {coursesMaster.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="border p-2 rounded" value={newCert.issue_date} onChange={e => setNewCert({...newCert, issue_date: e.target.value})} required />
                    <input type="date" className="border p-2 rounded" value={newCert.expiry_date} onChange={e => setNewCert({...newCert, expiry_date: e.target.value})} required />
                </div>
                <input type="file" className="text-sm" onChange={e => setCertFile(e.target.files[0])} required />
                <button disabled={uploading} className="w-full bg-slate-800 text-white py-2 rounded text-sm">{uploading ? '...' : 'Guardar'}</button>
            </form>
        </div>
    );
};

// --- COMPONENTE AUXILIAR 2: Documentos ---
const EmployeeDocuments = ({ employeeId, organizationId }) => {
    const [documents, setDocuments] = useState([]);
    const [newDocType, setNewDocType] = useState('');
    const [newDocFile, setNewDocFile] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);

    const fetchDocuments = useCallback(async () => {
        if (!employeeId) return;
        const { data } = await supabase.from('rrhh_employee_documents').select('*').eq('employee_id', employeeId);
        setDocuments(data || []);
    }, [employeeId]);

    useEffect(() => { fetchDocuments(); }, [fetchDocuments, employeeId]);

    const handleUploadDocument = async (e) => {
        e.preventDefault();
        setUploadingDoc(true);
        try {
            const fileExt = newDocFile.name.split('.').pop();
            const fileName = `${organizationId}/${employeeId}/${newDocType}_${Date.now()}.${fileExt}`;
            await supabase.storage.from('rrhh-files').upload(fileName, newDocFile);
            await supabase.from('rrhh_employee_documents').insert({
                employee_id: employeeId, organization_id: organizationId, document_type: newDocType, file_path: fileName
            });
            alert('Subido!'); setNewDocType(''); setNewDocFile(null); fetchDocuments();
        } catch (error) { alert(error.message); } finally { setUploadingDoc(false); }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold border-b pb-2">Carpeta Digital</h3>
            <ul className="space-y-2">
                {documents.map(doc => (
                    <li key={doc.id} className="flex justify-between text-sm bg-white p-2 border rounded">
                        <span>{doc.document_type}</span>
                        <a href={supabase.storage.from('rrhh-files').getPublicUrl(doc.file_path).data.publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Ver</a>
                    </li>
                ))}
            </ul>
            <form onSubmit={handleUploadDocument} className="flex gap-2 pt-2">
                <input className="border p-1 rounded text-sm flex-1" placeholder="Ej: Contrato" value={newDocType} onChange={e => setNewDocType(e.target.value)} required />
                <input type="file" className="text-xs w-20" onChange={e => setNewDocFile(e.target.files[0])} required />
                <button disabled={uploadingDoc} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">Subir</button>
            </form>
        </div>
    );
};

// --- COMPONENTE AUXILIAR 3: PANEL LATERAL ---
const EmployeeSidePanel = ({ 
    currentEmployee, editData, setEditData, handleSave, handleDelete, handleClose, 
    uploading, masters, organizationId, handleFileUpload
}) => {
    if (!currentEmployee) return null;
    const isNew = currentEmployee.isNew;
    const formTitle = isNew ? 'Nuevo Empleado' : `${editData.first_name} ${editData.last_name}`;
    const [activeTab, setActiveTab] = useState('personal');

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const finalValue = type === 'checkbox' ? checked : value;
        setEditData(prev => ({ ...prev, [name]: finalValue }));
    };
    
    const previewUrl = editData.photo_file ? URL.createObjectURL(editData.photo_file) : editData.photo_url;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-end" onClick={handleClose}>
            <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white p-5 border-b flex justify-between items-center z-20">
                    <h2 className="text-xl font-bold">{isNew ? 'Nuevo Empleado' : `${editData.first_name} ${editData.last_name}`}</h2>
                    <button onClick={handleClose} className="text-2xl text-gray-400">&times;</button>
                </div>
                
                <div className="flex bg-gray-50 border-b sticky top-[69px] z-20 overflow-x-auto">
                    {['personal', 'contract', 'social', 'acred', 'files'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-shrink-0 py-3 px-4 text-xs font-bold uppercase ${activeTab === tab ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>
                            {tab === 'personal' && 'Personal'}
                            {tab === 'contract' && 'Contrato'}
                            {tab === 'social' && 'Previsión'}
                            {tab === 'acred' && 'Acreditaciones'}
                            {tab === 'files' && 'Docs'}
                        </button>
                    ))}
                </div>

                <div className="p-6 flex-grow">
                    {activeTab === 'personal' && (
                        <div className="grid grid-cols-2 gap-4">
                             <div className="col-span-2 flex items-center gap-4 pb-4 border-b">
                                <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden">
                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : null}
                                </div>
                                <label className="cursor-pointer text-xs font-bold text-blue-600">
                                    Subir Foto <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0])} className="hidden" />
                                </label>
                            </div>
                            <input name="first_name" placeholder="Nombre" className="border p-2 rounded w-full" value={editData.first_name || ''} onChange={handleInputChange} />
                            <input name="last_name" placeholder="Apellido" className="border p-2 rounded w-full" value={editData.last_name || ''} onChange={handleInputChange} />
                            <input name="rut" placeholder="RUT (12.345.678-9)" className="border p-2 rounded w-full" value={editData.rut || ''} onChange={handleInputChange} />
                            <select name="marital_status_id" className="border p-2 rounded w-full bg-white" value={editData.marital_status_id || ''} onChange={handleInputChange}>
                                <option value="">Estado Civil...</option>
                                {masters.maritalStatus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input name="address" placeholder="Dirección" className="border p-2 rounded w-full col-span-2" value={editData.address || ''} onChange={handleInputChange} />
                        </div>
                    )}

                    {activeTab === 'contract' && (
                        <div className="space-y-4">
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                                <h4 className="text-sm font-bold text-indigo-800 mb-2">🔐 Acceso Reloj Control</h4>
                                <div className="grid grid-cols-1 gap-2">
                                    <label className="text-xs text-indigo-600">PIN de Acceso (4-6 dígitos)</label>
                                    <input 
                                        name="clock_pin" 
                                        type="text"
                                        maxLength={6}
                                        placeholder="Ej: 1234" 
                                        className="border p-2 rounded w-full font-mono tracking-widest" 
                                        value={editData.clock_pin || ''} 
                                        onChange={handleInputChange} 
                                    />
                                    <p className="text-[10px] text-indigo-500">
                                        * Este PIN + el RUT permitirán al trabajador marcar asistencia en el Kiosco.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500">Cargo</label>
                                    <select name="job_id" className="border p-2 rounded w-full bg-white" value={editData.job_id || ''} onChange={handleInputChange}>
                                        <option value="">Seleccione...</option>
                                        {masters.jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Departamento</label>
                                    <select name="department_id" className="border p-2 rounded w-full bg-white" value={editData.department_id || ''} onChange={handleInputChange}>
                                        <option value="">Seleccione...</option>
                                        {masters.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Sueldo Base</label>
                                    <input name="salary" type="number" className="border p-2 rounded w-full" value={editData.salary || ''} onChange={handleInputChange} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Fecha Ingreso</label>
                                    <input name="hire_date" type="date" className="border p-2 rounded w-full" value={editData.hire_date || ''} onChange={handleInputChange} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Tipo Contrato</label>
                                    <select name="contract_type_id" className="border p-2 rounded w-full bg-white" value={editData.contract_type_id || ''} onChange={handleInputChange}>
                                        <option value="">Seleccione...</option>
                                        {masters.contractTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-bold text-indigo-700">Turno Asignado</label>
                                    <select name="shift_id" className="border-2 border-indigo-100 p-2 rounded w-full bg-white" value={editData.shift_id || ''} onChange={handleInputChange}>
                                        <option value="">-- Sin Turno --</option>
                                        {masters.shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0,5)}-{s.end_time.slice(0,5)})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mt-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="is_subcontracted" checked={editData.is_subcontracted || false} onChange={handleInputChange} className="w-4 h-4 text-orange-600 rounded"/>
                                    <span className="text-sm font-bold text-orange-800">¿Es personal Subcontratado?</span>
                                </label>
                                {editData.is_subcontracted && (
                                    <div className="mt-3">
                                        <label className="text-xs text-orange-700 block mb-1">Empresa Contratista</label>
                                        <select name="subcontractor_id" className="w-full border border-orange-300 p-2 rounded bg-white" value={editData.subcontractor_id || ''} onChange={handleInputChange}>
                                            <option value="">-- Seleccionar --</option>
                                            {masters.subcontractors.map(sub => <option key={sub.id} value={sub.id}>{sub.business_name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'social' && (
                        <div className="grid grid-cols-2 gap-4">
                            <select name="pension_provider_id" className="border p-2 rounded w-full bg-white" value={editData.pension_provider_id || ''} onChange={handleInputChange}>
                                <option value="">AFP...</option>
                                {masters.pensionProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select name="health_provider_id" className="border p-2 rounded w-full bg-white" value={editData.health_provider_id || ''} onChange={handleInputChange}>
                                <option value="">Salud...</option>
                                {masters.healthProviders.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                        </div>
                    )}
                    
                    {activeTab === 'acred' && (!isNew ? <EmployeeCertifications employeeId={currentEmployee.id} organizationId={organizationId} coursesMaster={masters.courses} /> : <div className="text-center p-10 text-gray-400">Guarde primero.</div>)}
                    {activeTab === 'files' && (!isNew ? <EmployeeDocuments employeeId={currentEmployee.id} organizationId={organizationId} /> : <div className="text-center p-10 text-gray-400">Guarde primero.</div>)}

                    {['personal', 'contract', 'social'].includes(activeTab) && (
                        <div className="pt-6 mt-4 border-t">
                            <button type="button" onClick={handleSave} disabled={uploading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow hover:bg-blue-700 disabled:opacity-50">
                                {uploading ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                            {!isNew && (
                                <button type="button" onClick={handleDelete} className="w-full mt-3 text-red-600 text-sm font-medium hover:underline">
                                    Eliminar Empleado
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const EmployeeList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const pendingCount = usePendingRequests(user);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentEmployee, setCurrentEmployee] = useState(null);
    const [editData, setEditData] = useState({});
    const [uploading, setUploading] = useState(false);
    const [organizationId, setOrganizationId] = useState(null);
    const [showEmployeeList, setShowEmployeeList] = useState(false);
    
    const [masters, setMasters] = useState({ 
        jobs: [], departments: [], maritalStatus: [], pensionProviders: [], healthProviders: [], 
        contractTypes: [], subcontractors: [], courses: [], shifts: [] 
    });

    const initData = useCallback(async () => {
        try {
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
            const orgId = profile?.organization_id;
            if (!orgId) return;
            setOrganizationId(orgId);

            const [j, d, m, p, h, c, sub, cur, sh] = await Promise.all([
                supabase.from('rrhh_jobs').select('*'),
                supabase.from('rrhh_departments').select('*'),
                supabase.from('rrhh_marital_status').select('*'),
                supabase.from('rrhh_pension_providers').select('*'),
                supabase.from('rrhh_health_providers').select('*'),
                supabase.from('rrhh_contract_types').select('*'),
                supabase.from('rrhh_subcontractors').select('*').eq('organization_id', orgId),
                supabase.from('rrhh_course_catalog').select('*').eq('organization_id', orgId),
                supabase.from('rrhh_shifts').select('*').eq('organization_id', orgId) 
            ]);

            setMasters({
                jobs: j.data || [], departments: d.data || [], maritalStatus: m.data || [],
                pensionProviders: p.data || [], healthProviders: h.data || [], contractTypes: c.data || [],
                subcontractors: sub.data || [], courses: cur.data || [], shifts: sh.data || []
            });

            const { data: emps, error } = await supabase
                .from('rrhh_employees')
                .select(`*, job:job_id(name)`)
                .order('created_at', { ascending: false });
            
            if(error) throw error;
            setEmployees(emps || []);
            setLoading(false);

        } catch (error) { console.error(error); }
    }, [user]);

    useEffect(() => { if (user) initData(); }, [user, initData]);

    const handleOpenCreate = () => {
        setEditData({ is_subcontracted: false, hire_date: new Date().toISOString().split('T')[0] });
        setCurrentEmployee({ isNew: true });
    };

    const handleOpenEdit = (emp) => { setEditData({ ...emp }); setCurrentEmployee(emp); };
    const handleClose = () => { setCurrentEmployee(null); setEditData({}); };
    const handleFileUpload = (file) => { setEditData(prev => ({ ...prev, photo_file: file })); };

    const handleSave = async (e) => {
        if(e) e.preventDefault();
        setUploading(true);
        try {
            if (!editData.rut) throw new Error("El RUT es obligatorio para crear el acceso.");

            let photoUrl = editData.photo_url;
            if (editData.photo_file) {
                const ext = editData.photo_file.name.split('.').pop();
                const path = `${organizationId}/${currentEmployee.isNew ? 'new' : currentEmployee.id}/${Date.now()}.${ext}`;
                await supabase.storage.from('rrhh-files').upload(path, editData.photo_file);
                photoUrl = supabase.storage.from('rrhh-files').getPublicUrl(path).data.publicUrl;
            }

            const payload = {
                organization_id: organizationId,
                first_name: editData.first_name, last_name: editData.last_name, rut: cleanRut(editData.rut),
                job_id: editData.job_id, department_id: editData.department_id,
                salary: editData.salary, hire_date: editData.hire_date,
                contract_type_id: editData.contract_type_id,
                marital_status_id: editData.marital_status_id, address: editData.address,
                pension_provider_id: editData.pension_provider_id, health_provider_id: editData.health_provider_id,
                photo_url: photoUrl,
                is_subcontracted: editData.is_subcontracted,
                subcontractor_id: editData.is_subcontracted ? editData.subcontractor_id : null,
                shift_id: editData.shift_id,
                clock_pin: editData.clock_pin 
            };

            if (editData.clock_pin && editData.rut) {
               await createWorkerAuth(editData.rut, editData.clock_pin, `${editData.first_name} ${editData.last_name}`);
            }

            if (currentEmployee.isNew) await supabase.from('rrhh_employees').insert(payload);
            else await supabase.from('rrhh_employees').update(payload).eq('id', currentEmployee.id);

            alert('Guardado!'); handleClose(); initData();
        } catch (error) { alert(error.message); } finally { setUploading(false); }
    };

    const handleDelete = async () => {
        if(!window.confirm("¿Eliminar?")) return;
        try {
            await supabase.from('rrhh_employees').delete().eq('id', currentEmployee.id);
            handleClose(); initData();
        } catch (error) { alert(error.message); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
            
            {/* TOPBAR SIMPLE */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
                            👥
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Portal de Recursos Humanos</h1>
                            <p className="text-xs text-slate-500">SOMYL S.A.</p>
                        </div>
                    </div>
                    
                    {showEmployeeList ? (
                        <div className="flex gap-3">
                            {/* BOTÓN LRE (Nuevo) */}
                            <button 
                                onClick={() => navigate('/payroll/lre')} 
                                className="px-3 py-2 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-200 text-sm font-bold shadow-sm transition-all"
                            >
                                📚 Revisar Libro LRE (DT)
                            </button>

                            {/* BOTÓN CONTROL ASISTENCIA (Con Alerta) */}
                            <button 
                                onClick={() => navigate('/attendance')} 
                                className="relative px-3 py-2 bg-emerald-600 text-white border border-emerald-700 rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
                            >
                                <span>📅 Control Asistencia</span>
                                {pendingCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm animate-pulse">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>

                            <button 
                                onClick={() => setShowEmployeeList(false)} 
                                className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium text-sm transition-all duration-200 flex items-center gap-2"
                            >
                                <span>←</span>
                                Portal RRHH
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => window.location.href = PORTAL_URL} 
                            className="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-200 font-medium text-sm transition-all duration-200 flex items-center gap-2"
                        >
                            <span>⬅</span>
                            Volver al Portal
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="max-w-7xl mx-auto px-6 py-12">
                
                {showEmployeeList ? (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Lista de Empleados</h2>
                                <p className="text-sm text-slate-500">Gestión de personal</p>
                            </div>
                            <button 
                                onClick={handleOpenCreate} 
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                            >
                                <span className="text-lg">+</span>
                                Nuevo Empleado
                            </button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Empleado</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Cargo</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Tipo</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400">Cargando...</td></tr>
                                        ) : employees.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400">No hay empleados</td></tr>
                                        ) : (
                                            employees.map(e => (
                                                <tr key={e.id} onClick={() => handleOpenEdit(e)} className="hover:bg-blue-50 cursor-pointer transition-all duration-150 group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                                {e.first_name?.[0]}{e.last_name?.[0]}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{e.first_name} {e.last_name}</div>
                                                                <div className="text-xs text-slate-400 font-mono">{e.rut || 'Sin RUT'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4"><span className="text-sm text-slate-600">{e.job?.name || '-'}</span></td>
                                                    <td className="px-6 py-4 text-center">
                                                        {e.is_subcontracted ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">Subcontratado</span> : <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">Planta</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-center"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Activo</span></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {employees.length > 0 && <div className="bg-slate-50 px-6 py-3 border-t border-slate-200"><p className="text-xs text-slate-500">Mostrando <span className="font-semibold text-slate-700">{employees.length}</span> empleado{employees.length !== 1 ? 's' : ''}</p></div>}
                        </div>
                    </>
                ) : (
                    // VISTA DE MÓDULOS (DASHBOARD RRHH)
                    <>
                        <div className="mb-8 text-center">
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">Tus Módulos</h2>
                            <p className="text-slate-600">Selecciona un módulo para comenzar</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            
                            <div onClick={() => setShowEmployeeList(true)} className="bg-white rounded-xl shadow-md hover:shadow-xl border border-slate-200 p-6 cursor-pointer transition-all duration-300 hover:scale-105 group h-[160px] flex flex-col">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg"><span className="text-2xl">👥</span></div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Empleados</h3><p className="text-xs text-slate-500">Gestión de personal</p>
                            </div>

                            <div onClick={() => navigate('/attendance')} className="relative bg-white rounded-xl shadow-md hover:shadow-xl border border-slate-200 p-6 cursor-pointer transition-all duration-300 hover:scale-105 group h-[160px] flex flex-col">
                                {pendingCount > 0 && <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-lg animate-pulse">{pendingCount}</div>}
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg"><span className="text-2xl">📅</span></div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Asistencia</h3><p className="text-xs text-slate-500">Control de marcas</p>
                            </div>

                            <div onClick={() => navigate('/absences')} className="bg-white rounded-xl shadow-md hover:shadow-xl border border-slate-200 p-6 cursor-pointer transition-all duration-300 hover:scale-105 group h-[160px] flex flex-col">
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg"><span className="text-2xl">🗓️</span></div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Ausencias</h3><p className="text-xs text-slate-500">Vacaciones y permisos</p>
                            </div>

                            <div onClick={() => navigate('/payroll/settings')} className="bg-white rounded-xl shadow-md hover:shadow-xl border border-slate-200 p-6 cursor-pointer transition-all duration-300 hover:scale-105 group h-[160px] flex flex-col">
                                <div className="w-14 h-14 bg-gradient-to-br from-slate-400 to-slate-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg"><span className="text-2xl">💰</span></div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Parámetros</h3><p className="text-xs text-slate-500">Config. nómina</p>
                            </div>

                            <div onClick={() => navigate('/payroll/process')} className="bg-white rounded-xl shadow-md hover:shadow-xl border border-slate-200 p-6 cursor-pointer transition-all duration-300 hover:scale-105 group h-[160px] flex flex-col">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg"><span className="text-2xl">🧮</span></div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Calcular</h3><p className="text-xs text-slate-500">Procesar nóminas</p>
                            </div>

                            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl shadow-md border border-slate-300 p-6 h-[160px] flex flex-col">
                                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm"><span className="text-xl">⚙️</span></div>
                                    <h3 className="text-base font-bold text-slate-700">Config.</h3>
                                </div>
                                <div className="space-y-1 overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                                    <button onClick={() => navigate('/settings/shifts')} className="w-full text-left px-2 py-1 bg-white rounded text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">🕒 Turnos</button>
                                    <button onClick={() => navigate('/settings/subcontractors')} className="w-full text-left px-2 py-1 bg-white rounded text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">🏢 Contratistas</button>
                                    <button onClick={() => navigate('/settings/courses')} className="w-full text-left px-2 py-1 bg-white rounded text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">🎓 Cursos</button>
                                    <button onClick={() => navigate('/settings/afp')} className="w-full text-left px-2 py-1 bg-white rounded text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-all font-medium">🏦 AFP</button>
                                </div>
                            </div>

                        </div>
                    </>
                )}
            </div>

            <EmployeeSidePanel 
                currentEmployee={currentEmployee} editData={editData} setEditData={setEditData}
                handleSave={handleSave} handleDelete={handleDelete} handleClose={handleClose} uploading={uploading} 
                masters={masters} organizationId={organizationId} handleFileUpload={handleFileUpload}
            />
        </div>
    );
};

export default EmployeeList;