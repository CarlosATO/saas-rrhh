import { AuthProvider } from './context/AuthContext'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import EmployeeList from './pages/EmployeeList'
import JobSettings from './pages/JobSettings'
import AbsenceManagement from './pages/AbsenceManagement'
import BalanceSettings from './pages/BalanceSettings'
import SubcontractorSettings from './pages/SubcontractorSettings'
import CourseSettings from './pages/CourseSettings'
import ShiftSettings from './pages/ShiftSettings'
import EmployeePortal from './pages/EmployeePortal'
import AttendanceControl from './pages/AttendanceControl'
import WorkerLogin from './pages/WorkerLogin'
import PayrollSettings from './pages/PayrollSettings'
import PayrollGenerator from './pages/PayrollGenerator'
import AFPSettings from './pages/AFPSettings';
import LREGenerator from './pages/LREGenerator';
import './index.css'

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 font-sans text-slate-900">
        <BrowserRouter>
          <Routes>
            {/* ==================== MÓDULO PRINCIPAL ==================== */}
            <Route path="/" element={<EmployeeList />} />
            
            {/* ==================== MÓDULO DE ASISTENCIA ==================== */}
            <Route path="/attendance" element={<AttendanceControl />} />
            <Route path="/clock" element={<EmployeePortal />} />
            <Route path="/worker-login" element={<WorkerLogin />} />
            
            {/* ==================== MÓDULO DE AUSENCIAS ==================== */}
            <Route path="/absences" element={<AbsenceManagement />} />
            
            {/* ==================== MÓDULO DE NÓMINA ==================== */}
            <Route path="/payroll/settings" element={<PayrollSettings />} />
            <Route path="/payroll/process" element={<PayrollGenerator />} />
            
            {/* ==================== CONFIGURACIONES ==================== */}
            <Route path="/settings/jobs" element={<JobSettings />} />
            <Route path="/settings/shifts" element={<ShiftSettings />} />
            <Route path="/settings/subcontractors" element={<SubcontractorSettings />} />
            <Route path="/settings/courses" element={<CourseSettings />} />
            <Route path="/settings/balances" element={<BalanceSettings />} />
            <Route path="/settings/afp" element={<AFPSettings />} />
            <Route path="/payroll/lre" element={<LREGenerator />} />
            
            {/* ==================== FALLBACK ==================== */}
            <Route path="*" element={<EmployeeList />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  )
}

export default App