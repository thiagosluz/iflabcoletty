import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import { Toaster } from './components/ui/toaster';
import { ErrorBoundary } from './components/ErrorBoundary';

import Dashboard from './pages/Dashboard';

import Labs from './pages/Labs';
import LabDetails from './pages/LabDetails';
import Computers from './pages/Computers';
import ComputerDetails from './pages/ComputerDetails';
import Softwares from './pages/Softwares';
import Schedules from '@/pages/Schedules';
import AuditLogs from './pages/AuditLogs';
import LogViewer from './pages/LogViewer';
import ReportJobs from './pages/ReportJobs';
import Backups from './pages/Backups';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Notifications from './pages/Notifications';
import Alerts from './pages/Alerts';
import AlertRules from './pages/AlertRules';
import PublicComputerView from './pages/PublicComputerView';
import SystemHealth from './pages/SystemHealth';
import SoftwareInstallation from './pages/SoftwareInstallation';
import AgentDownloads from './pages/AgentDownloads';

function App() {
  return (
    <Router>
      <ErrorBoundary
        title="Algo deu errado"
        description="Ocorreu um erro inesperado. Recarregue a página para continuar."
        showReload
      >
        <Routes>
        <Route path="/login" element={<Login />} />

        {/* Public Routes */}
        <Route path="/public/pc/:hash" element={<PublicComputerView />} />

        <Route path="/admin" element={<DashboardLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="labs" element={<Labs />} />
          <Route path="labs/:id" element={<LabDetails />} />
          <Route path="computers" element={<Computers />} />
          <Route path="computers/:id" element={<ComputerDetails />} />
          <Route path="softwares" element={<Softwares />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="logs" element={<LogViewer />} />
          <Route path="report-jobs" element={<ReportJobs />} />
          <Route path="backups" element={<Backups />} />
          <Route path="users" element={<Users />} />
          <Route path="roles" element={<Roles />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="alert-rules" element={<AlertRules />} />
          <Route path="system-health" element={<SystemHealth />} />
          <Route path="software-installations" element={<SoftwareInstallation />} />
          <Route path="agent-downloads" element={<AgentDownloads />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </ErrorBoundary>
      <Toaster />
    </Router>
  );
}

export default App;
