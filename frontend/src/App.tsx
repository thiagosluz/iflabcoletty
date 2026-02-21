import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import { Toaster } from './components/ui/toaster';
import { ErrorBoundary } from './components/ErrorBoundary';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Labs = lazy(() => import('./pages/Labs'));
const LabDetails = lazy(() => import('./pages/LabDetails'));
const Computers = lazy(() => import('./pages/Computers'));
const ComputerDetails = lazy(() => import('./pages/ComputerDetails'));
const Softwares = lazy(() => import('./pages/Softwares'));
const Schedules = lazy(() => import('@/pages/Schedules'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const LogViewer = lazy(() => import('./pages/LogViewer'));
const ReportJobs = lazy(() => import('./pages/ReportJobs'));
const Backups = lazy(() => import('./pages/Backups'));
const Users = lazy(() => import('./pages/Users'));
const Roles = lazy(() => import('./pages/Roles'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AlertRules = lazy(() => import('./pages/AlertRules'));
const PublicComputerView = lazy(() => import('./pages/PublicComputerView'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const SoftwareInstallation = lazy(() => import('./pages/SoftwareInstallation'));
const Commands = lazy(() => import('./pages/Commands'));
const AgentDownloads = lazy(() => import('./pages/AgentDownloads'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ErrorBoundary
        title="Algo deu errado"
        description="Ocorreu um erro inesperado. Recarregue a página para continuar."
        showReload
      >
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

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
              <Route path="commands" element={<Commands />} />
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
        </Suspense>
      </ErrorBoundary>
      <Toaster />
    </Router>
  );
}

export default App;
