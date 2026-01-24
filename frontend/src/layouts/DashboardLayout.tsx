import { useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Monitor, Server, LogOut, Package, FileText, Download, Database, Users, Shield } from 'lucide-react';

export default function DashboardLayout() {
    const { isAuthenticated, logout, checkAuth } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        } else {
            checkAuth(); // Verify token validity
        }
    }, [isAuthenticated, navigate, checkAuth]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!isAuthenticated) return null;

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r hidden md:flex md:flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold">IFLab Manager</h1>
                </div>
                <nav className="space-y-1 px-4 flex-1">
                    <Link to="/admin/dashboard" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <LayoutDashboard className="mr-3 h-5 w-5" />
                        Dashboard
                    </Link>
                    <Link to="/admin/labs" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <Server className="mr-3 h-5 w-5" />
                        Laboratórios
                    </Link>
                    <Link to="/admin/computers" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <Monitor className="mr-3 h-5 w-5" />
                        Computadores
                    </Link>
                    <Link to="/admin/softwares" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <Package className="mr-3 h-5 w-5" />
                        Software
                    </Link>
                    <Link to="/admin/audit-logs" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <FileText className="mr-3 h-5 w-5" />
                        Logs de Auditoria
                    </Link>
                    <Link to="/admin/report-jobs" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <Download className="mr-3 h-5 w-5" />
                        Relatórios
                    </Link>
                    <Link to="/admin/backups" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <Database className="mr-3 h-5 w-5" />
                        Backups
                    </Link>
                    <Link to="/admin/users" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <Users className="mr-3 h-5 w-5" />
                        Usuários
                    </Link>
                    <Link to="/admin/roles" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                        <Shield className="mr-3 h-5 w-5" />
                        Roles
                    </Link>
                </nav>
                <div className="p-4 border-t">
                    <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                        <LogOut className="mr-3 h-5 w-5" />
                        Sair
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <Outlet />
            </main>
        </div>
    );
}
