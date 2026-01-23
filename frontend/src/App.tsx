import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import { Toaster } from './components/ui/toaster'; // Assuming toaster exists or I need to create it

import Dashboard from './pages/Dashboard';

import Labs from './pages/Labs';
import LabDetails from './pages/LabDetails';
import Computers from './pages/Computers';
import ComputerDetails from './pages/ComputerDetails';
import Softwares from './pages/Softwares';
import PublicComputerView from './pages/PublicComputerView';

function App() {
  return (
    <Router>
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
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
