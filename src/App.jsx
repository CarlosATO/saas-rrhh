import { AuthProvider } from './context/AuthContext'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import EmployeeList from './pages/EmployeeList'
import JobSettings from './pages/JobSettings'
import AbsenceManagement from './pages/AbsenceManagement'
import BalanceSettings from './pages/BalanceSettings'
import SubcontractorSettings from './pages/SubcontractorSettings';
import CourseSettings from './pages/CourseSettings';
import ShiftSettings from './pages/ShiftSettings';
import EmployeePortal from './pages/EmployeePortal';
import AttendanceControl from './pages/AttendanceControl';
import WorkerLogin from './pages/WorkerLogin';
import './index.css'

function App() {
  return (
    // Ahora sí proveemos el contexto que EmployeeList necesita
    <AuthProvider>
      <div className="font-sans text-slate-900">
        <BrowserRouter>
          <Routes>
            {/* Ruta principal: Lista de empleados */}
            <Route path="/" element={<EmployeeList />} /> 

            <Route path="/absences" element={<AbsenceManagement />} /> {/* <--- NUEVA RUTA */}
            <Route path="/settings/subcontractors" element={<SubcontractorSettings />} />
            <Route path="/settings/courses" element={<CourseSettings />} />
            <Route path="/settings/balances" element={<BalanceSettings />} /> {/* <--- NUEVA RUTA */}
            {/* RUTA DE CONFIGURACIÓN DE CARGOS */}
            <Route path="/clock" element={<EmployeePortal />} />
            <Route path="/worker-login" element={<WorkerLogin />} />
            <Route path="/settings/shifts" element={<ShiftSettings />} />
            <Route path="/settings/jobs" element={<JobSettings />} />
            <Route path="/attendance" element={<AttendanceControl />} />
            <Route path="*" element={<EmployeeList />} /> 
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  )
}

export default App