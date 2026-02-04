import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Monitor, Server, LogOut, Package, FileText, Download, Database, Users, Shield, AlertTriangle, Settings, Activity, Clock as ClockIcon, PanelLeftClose, PanelLeft } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { GlobalSearch } from '@/components/GlobalSearch';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

function getInitialCollapsed(): boolean {
    try {
        const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return stored === 'true';
    } catch {
        return false;
    }
}

export default function DashboardLayout() {
    const { isAuthenticated, logout, checkAuth } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(getInitialCollapsed);

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

    const toggleCollapsed = () => {
        setCollapsed((c) => {
            const next = !c;
            try {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
            } catch {}
            return next;
        });
    };

    const isActive = (path: string) =>
        location.pathname === path || location.pathname.startsWith(path + '/');

    const navLinkClass = (path: string, isCollapsed: boolean) => {
        const active = isActive(path);
        const base = 'flex items-center rounded-md py-2 transition-colors';
        const padding = isCollapsed ? 'px-2 justify-center' : 'px-4 justify-start';
        const activeClass = active
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'text-gray-700 hover:bg-gray-100';
        return `${base} ${padding} ${activeClass}`;
    };

    if (!isAuthenticated) return null;

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside
                className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r hidden md:flex md:flex-col transition-all duration-200 shrink-0`}
            >
                <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : ''}`}>
                    {collapsed ? (
                        <span className="text-lg font-bold truncate" title="IFLab Manager">
                            IF
                        </span>
                    ) : (
                        <h1 className="text-2xl font-bold truncate">IFLab Manager</h1>
                    )}
                </div>
                <nav className="space-y-1 px-2 flex-1 overflow-hidden">
                    <Link to="/admin/dashboard" className={navLinkClass('/admin/dashboard', collapsed)} title="Dashboard">
                        <LayoutDashboard className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Dashboard</span>}
                        {collapsed && <span className="sr-only">Dashboard</span>}
                    </Link>
                    <Link to="/admin/labs" className={navLinkClass('/admin/labs', collapsed)} title="Laboratórios">
                        <Server className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Laboratórios</span>}
                        {collapsed && <span className="sr-only">Laboratórios</span>}
                    </Link>
                    <Link to="/admin/computers" className={navLinkClass('/admin/computers', collapsed)} title="Computadores">
                        <Monitor className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Computadores</span>}
                        {collapsed && <span className="sr-only">Computadores</span>}
                    </Link>
                    <Link to="/admin/schedules" className={navLinkClass('/admin/schedules', collapsed)} title="Automação">
                        <ClockIcon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Automação</span>}
                        {collapsed && <span className="sr-only">Automação</span>}
                    </Link>
                    <Link to="/admin/softwares" className={navLinkClass('/admin/softwares', collapsed)} title="Software">
                        <Package className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Software</span>}
                        {collapsed && <span className="sr-only">Software</span>}
                    </Link>
                    <Link to="/admin/alerts" className={navLinkClass('/admin/alerts', collapsed)} title="Alertas">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Alertas</span>}
                        {collapsed && <span className="sr-only">Alertas</span>}
                    </Link>
                    <Link to="/admin/alert-rules" className={navLinkClass('/admin/alert-rules', collapsed)} title="Regras de Alerta">
                        <Settings className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Regras de Alerta</span>}
                        {collapsed && <span className="sr-only">Regras de Alerta</span>}
                    </Link>
                    <Link to="/admin/audit-logs" className={navLinkClass('/admin/audit-logs', collapsed)} title="Logs de Auditoria">
                        <FileText className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Logs de Auditoria</span>}
                        {collapsed && <span className="sr-only">Logs de Auditoria</span>}
                    </Link>
                    <Link to="/admin/logs" className={navLinkClass('/admin/logs', collapsed)} title="Logs do Sistema">
                        <FileText className="h-5 w-5 shrink-0 text-indigo-600" />
                        {!collapsed && <span className="ml-3 truncate">Logs do Sistema</span>}
                        {collapsed && <span className="sr-only">Logs do Sistema</span>}
                    </Link>
                    <Link to="/admin/report-jobs" className={navLinkClass('/admin/report-jobs', collapsed)} title="Relatórios">
                        <Download className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Relatórios</span>}
                        {collapsed && <span className="sr-only">Relatórios</span>}
                    </Link>
                    <Link to="/admin/backups" className={navLinkClass('/admin/backups', collapsed)} title="Backups">
                        <Database className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Backups</span>}
                        {collapsed && <span className="sr-only">Backups</span>}
                    </Link>
                    <Link to="/admin/system-health" className={navLinkClass('/admin/system-health', collapsed)} title="Saúde do Sistema">
                        <Activity className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Saúde do Sistema</span>}
                        {collapsed && <span className="sr-only">Saúde do Sistema</span>}
                    </Link>
                    <Link to="/admin/software-installations" className={navLinkClass('/admin/software-installations', collapsed)} title="Instalação de Programas">
                        <Package className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Instalação de Programas</span>}
                        {collapsed && <span className="sr-only">Instalação de Programas</span>}
                    </Link>
                    <Link to="/admin/agent-downloads" className={navLinkClass('/admin/agent-downloads', collapsed)} title="Downloads do Agente">
                        <Download className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Downloads do Agente</span>}
                        {collapsed && <span className="sr-only">Downloads do Agente</span>}
                    </Link>
                    <Link to="/admin/users" className={navLinkClass('/admin/users', collapsed)} title="Usuários">
                        <Users className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Usuários</span>}
                        {collapsed && <span className="sr-only">Usuários</span>}
                    </Link>
                    <Link to="/admin/roles" className={navLinkClass('/admin/roles', collapsed)} title="Roles">
                        <Shield className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3 truncate">Roles</span>}
                        {collapsed && <span className="sr-only">Roles</span>}
                    </Link>
                </nav>
                <div className="p-2 border-t space-y-1">
                    <Button
                        variant="ghost"
                        size={collapsed ? 'icon' : 'default'}
                        className={collapsed ? 'w-full' : 'w-full justify-start'}
                        onClick={toggleCollapsed}
                        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                        {collapsed ? (
                            <PanelLeft className="h-5 w-5" />
                        ) : (
                            <>
                                <PanelLeftClose className="mr-3 h-5 w-5" />
                                Recolher menu
                            </>
                        )}
                    </Button>
                    <Button variant="outline" size={collapsed ? 'icon' : 'default'} className={collapsed ? 'w-full' : 'w-full justify-start'} onClick={handleLogout} title="Sair">
                        <LogOut className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="ml-3">Sair</span>}
                        {collapsed && <span className="sr-only">Sair</span>}
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 min-w-0">
                <div className="mb-4 flex justify-between items-center gap-4">
                    <div className="flex-1 max-w-xl">
                        <GlobalSearch />
                    </div>
                    <NotificationBell />
                </div>
                <Outlet />
            </main>
        </div>
    );
}
