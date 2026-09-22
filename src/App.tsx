import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from '@/lib/app-context'
import { AssistantProvider } from '@/lib/assistant-context'
import { Shell } from '@/components/Shell'
import { Assistant } from '@/components/Assistant'
import { can, type Section } from '@/lib/roles'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Patients from '@/pages/Patients'
import PatientDetail from '@/pages/PatientDetail'
import Appointments from '@/pages/Appointments'
import Billing from '@/pages/Billing'
import Inventory from '@/pages/Inventory'
import StaffPage from '@/pages/StaffPage'
import Audit from '@/pages/Audit'

/** A route the current role cannot reach sends the user home rather than to an
 *  error page — nobody arrives at a forbidden URL on purpose. */
function Guarded({ section, children }: { section: Section; children: React.ReactNode }) {
  const { session } = useApp()
  if (!session) return <Navigate to="/" replace />
  return can(session.role, section) ? <>{children}</> : <Navigate to="/" replace />
}

function Routed() {
  const { session } = useApp()
  if (!session) return <Login />

  return (
    <AssistantProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Guarded section="patients"><Patients /></Guarded>} />
          <Route path="/patients/:id" element={<Guarded section="patients"><PatientDetail /></Guarded>} />
          <Route path="/appointments" element={<Guarded section="appointments"><Appointments /></Guarded>} />
          <Route path="/billing" element={<Guarded section="billing"><Billing /></Guarded>} />
          <Route path="/inventory" element={<Guarded section="inventory"><Inventory /></Guarded>} />
          <Route path="/staff" element={<Guarded section="staff"><StaffPage /></Guarded>} />
          <Route path="/audit" element={<Guarded section="audit"><Audit /></Guarded>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <Assistant />
    </AssistantProvider>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </AppProvider>
  )
}
