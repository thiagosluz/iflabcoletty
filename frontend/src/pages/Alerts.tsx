import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { Alert } from '@/types/alerts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Filter, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';

export default function Alerts() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('active');
    const [filterSeverity, setFilterSeverity] = useState<string>('all');
    const [stats, setStats] = useState<{ total_active: number; by_severity: Record<string, number> }>({
        total_active: 0,
        by_severity: {},
    });
    const { toast } = useToast();

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'all') params.append('status', filterStatus);
            if (filterSeverity !== 'all') params.append('severity', filterSeverity);

            const { data } = await apiClient.get(`/alerts?${params.toString()}`);
            setAlerts(data.data || []);
            
            // Also fetch stats
            const statsRes = await apiClient.get('/alerts/stats');
            setStats(statsRes.data);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000); // Auto refresh every 30s
        return () => clearInterval(interval);
    }, [filterStatus, filterSeverity]);

    const handleResolve = async (alert: Alert) => {
        try {
            await apiClient.post(`/alerts/${alert.id}/resolve`);
            toast({ title: 'Alerta resolvido', description: 'O alerta foi marcado como resolvido.' });
            fetchAlerts();
        } catch (error) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical': return <Badge variant="destructive">Crítico</Badge>;
            case 'warning': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Alerta</Badge>;
            default: return <Badge variant="outline">Info</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Alertas do Sistema</h2>
                <Button variant="outline" onClick={fetchAlerts} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ativos</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_active}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Críticos</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.by_severity['critical'] || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Alertas</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{stats.by_severity['warning'] || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-4 py-4">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filtros:</span>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="resolved">Resolvidos</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Severidade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Severidades</SelectItem>
                        <SelectItem value="critical">Crítico</SelectItem>
                        <SelectItem value="warning">Alerta</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Severidade</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Computador</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {alerts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Nenhum alerta encontrado com os filtros atuais.
                                </TableCell>
                            </TableRow>
                        ) : (
                            alerts.map((alert) => (
                                <TableRow key={alert.id}>
                                    <TableCell>{getSeverityIcon(alert.severity)}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{alert.title}</div>
                                        <div className="text-xs text-muted-foreground">{alert.description}</div>
                                    </TableCell>
                                    <TableCell>
                                        {alert.computer ? (
                                            <div className="text-sm">
                                                {alert.computer.hostname || alert.computer.machine_id}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(alert.created_at).toLocaleString('pt-BR')}
                                    </TableCell>
                                    <TableCell>
                                        {alert.status === 'active' ? (
                                            <Badge variant="default" className="bg-red-500">Ativo</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Resolvido</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {alert.status === 'active' && (
                                            <Button size="sm" variant="ghost" onClick={() => handleResolve(alert)}>
                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                Resolver
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
