import { AuthProvider } from './context/AuthContext'
import EmployeeList from './pages/EmployeeList'
import './index.css'

function App() {
  return (
    // Ahora sí proveemos el contexto que EmployeeList necesita
    <AuthProvider>
      <div className="font-sans text-slate-900">
         <EmployeeList />
      </div>
    </AuthProvider>
  )
}

export default App