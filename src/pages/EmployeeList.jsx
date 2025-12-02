import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../context/AuthContext'

const EmployeeList = () => {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  const [newEmp, setNewEmp] = useState({ first_name: '', last_name: '', position: '', salary: '' })
  const [uploading, setUploading] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)

  useEffect(() => {
    if (user) fetchEmployees()
  }, [user])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('rrhh_employees')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setUploading(true)

    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (!profile?.organization_id) throw new Error("No tienes empresa asignada")

      let finalPhotoUrl = null

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${profile.organization_id}/${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('rrhh-files')
          .upload(filePath, avatarFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('rrhh-files')
          .getPublicUrl(filePath)
        
        finalPhotoUrl = publicUrl
      }

      const { error } = await supabase.from('rrhh_employees').insert({
        organization_id: profile.organization_id,
        first_name: newEmp.first_name,
        last_name: newEmp.last_name,
        position: newEmp.position,
        salary: newEmp.salary,
        photo_url: finalPhotoUrl
      })

      if (error) throw error

      alert('Empleado creado correctamente')
      setShowForm(false)
      setNewEmp({ first_name: '', last_name: '', position: '', salary: '' })
      setAvatarFile(null)
      fetchEmployees()

    } catch (error) {
      alert(error.message)
    } finally {
      setUploading(false)
    }
  }

  // Función para volver al Portal usando la variable de entorno
  const goBackToPortal = () => {
    window.location.href = import.meta.env.VITE_PORTAL_URL
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* ENCABEZADO CON BOTÓN DE RETORNO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Nómina de Empleados</h1>
            <p className="text-slate-500">Gestión de recursos humanos</p>
          </div>
          
          <div className="flex gap-3">
            {/* Botón Volver */}
            <button 
              onClick={goBackToPortal}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors shadow-sm font-medium"
            >
              ⬅ Volver al Portal
            </button>

            {/* Botón Nuevo Empleado */}
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors"
            >
              {showForm ? 'Cancelar' : '+ Nuevo Empleado'}
            </button>
          </div>
        </div>

        {/* Formulario de Alta */}
        {showForm && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-800">Datos del nuevo empleado</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Nombre" required className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={newEmp.first_name} onChange={e => setNewEmp({...newEmp, first_name: e.target.value})} />
              <input placeholder="Apellido" required className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={newEmp.last_name} onChange={e => setNewEmp({...newEmp, last_name: e.target.value})} />
              <input placeholder="Cargo" required className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={newEmp.position} onChange={e => setNewEmp({...newEmp, position: e.target.value})} />
              <input placeholder="Salario" type="number" required className="border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={newEmp.salary} onChange={e => setNewEmp({...newEmp, salary: e.target.value})} />
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Foto de Perfil</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={uploading} className="w-full bg-slate-900 text-white p-2 rounded hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium">
                  {uploading ? 'Subiendo foto y guardando...' : 'Guardar Empleado'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabla de Empleados */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                <th className="p-4">Empleado</th>
                <th className="p-4">Cargo</th>
                <th className="p-4">Salario</th>
                <th className="p-4">Fecha Ingreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Cargando nómina...</td></tr>}
              {!loading && employees.length === 0 && (
                <tr><td colSpan="4" className="p-12 text-center text-slate-400">No hay empleados registrados en esta empresa.</td></tr>
              )}
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                      {emp.photo_url ? (
                        <img src={emp.photo_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-slate-400 font-bold bg-slate-100">
                          {emp.first_name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</div>
                      <div className="text-xs text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">ID: {emp.id.slice(0,6)}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="bg-blue-50 text-blue-700 py-1 px-2 rounded text-xs font-medium border border-blue-100">
                      {emp.position}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-600 font-medium">${Number(emp.salary).toLocaleString()}</td>
                  <td className="p-4 text-slate-500 text-sm">{new Date(emp.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default EmployeeList