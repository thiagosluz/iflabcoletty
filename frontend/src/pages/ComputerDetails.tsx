import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import { isComputerOnline, copyToClipboard } from '@/lib/utils';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Copy, Download, QrCode, ChevronLeft, ChevronRight, Search, Package, Cpu, MemoryStick, HardDrive, Monitor as MonitorIcon, Activity, Clock, Network, Power, RotateCw, Lock, MessageSquare, Zap, RefreshCw, Code2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Ban, Terminal } from "lucide-react"

interface HardwareInfo {
    cpu?: {
        physical_cores?: number;
        logical_cores?: number;
        processor?: string;
    };
    memory?: {
        total_gb?: number;
        available_gb?: number;
    };
    disk?: {
        total_gb?: number;
        used_gb?: number;
        free_gb?: number;
    };
    network?: {
        name: string;
        ipv4: string[];
        ipv6: string[];
        mac: string | null;
    }[];
    os?: {
        system?: string;
        release?: string;
        version?: string;
    };
}

interface Software {
    id: number;
    name: string;
    version: string | null;
    vendor: string | null;
    pivot?: {
        installed_at: string;
    };
}

interface ActivityLog {
    id: number;
    type: string;
    description: string;
    payload: any;
    created_at: string;
}

interface ComputerMetric {
    id: number;
    cpu_usage_percent: number;
    memory_usage_percent: number;
    memory_total_gb: number;
    memory_free_gb: number;
    disk_usage: any[];
    network_stats: any;
    uptime_seconds: number;
    processes_count: number;
    recorded_at: string;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface Computer {
    id: number;
    machine_id: string;
    public_hash: string;
    hostname: string | null;
    hardware_info: HardwareInfo | null;
    agent_version?: string | null;
    latest_agent_version?: string;
    lab: {
        id: number;
        name: string;
    };
    created_at: string;
    updated_at: string;
}

export default function ComputerDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [computer, setComputer] = useState<Computer | null>(null);
    const [loading, setLoading] = useState(true);
    const [softwares, setSoftwares] = useState<Software[]>([]);
    const [softwareSearch, setSoftwareSearch] = useState('');
    const [softwareCurrentPage, setSoftwareCurrentPage] = useState(1);
    const [softwarePerPage, setSoftwarePerPage] = useState(20);
    const [softwarePagination, setSoftwarePagination] = useState<PaginationMeta | null>(null);
    const [loadingSoftwares, setLoadingSoftwares] = useState(false);
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [activityCurrentPage, setActivityCurrentPage] = useState(1);
    const [activityPerPage, setActivityPerPage] = useState(20);
    const [activityPagination, setActivityPagination] = useState<PaginationMeta | null>(null);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [metrics, setMetrics] = useState<ComputerMetric[]>([]);
    const [messageText, setMessageText] = useState('');
    const [isMessageOpen, setIsMessageOpen] = useState(false);
    const { toast } = useToast();

    // Supervision State
    const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
    const [loadingScreenshot, setLoadingScreenshot] = useState(false);
    const [processes, setProcesses] = useState<any[]>([]);
    const [loadingProcesses, setLoadingProcesses] = useState(false);
    const [autoRefreshScreen, setAutoRefreshScreen] = useState(false);

    // Process Manager Enhancements
    const [processSearch, setProcessSearch] = useState('');
    const [processSort, setProcessSort] = useState<'cpu' | 'memory' | 'name'>('cpu');
    const [processSortDirection, setProcessSortDirection] = useState<'asc' | 'desc'>('desc');

    // Terminal State
    const [terminalInput, setTerminalInput] = useState('');
    const [terminalHistory, setTerminalHistory] = useState<{ type: 'command' | 'output' | 'error', content: string, timestamp: Date }[]>([]);
    const [isTerminalLoading, setIsTerminalLoading] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (autoRefreshScreen && id) {
            fetchScreenshot(); // Initial fetch
            interval = setInterval(fetchScreenshot, 5000);
        }
        return () => clearInterval(interval);
    }, [autoRefreshScreen, id]);

    useEffect(() => {
        fetchComputer();
        fetchMetrics();
        // Refresh metrics every 30s
        const interval = setInterval(fetchMetrics, 30000);
        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        if (computer) {
            fetchSoftwares();
        }
    }, [computer, softwareCurrentPage, softwarePerPage, softwareSearch]);

    useEffect(() => {
        if (computer) {
            fetchActivities();
        }
    }, [computer, activityCurrentPage, activityPerPage]);

    const fetchComputer = async () => {
        try {
            const response = await apiClient.get(`/computers/${id}`);
            setComputer(response.data);
        } catch (error) {
            console.error('Falha ao buscar computador:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMetrics = async () => {
        if (!id) return;
        try {
            const response = await apiClient.get(`/computers/${id}/metrics?limit=1`);
            setMetrics(response.data || []);
        } catch (error) {
            console.error('Falha ao buscar métricas:', error);
        }
    };

    const fetchSoftwares = async () => {
        if (!id) return;

        try {
            setLoadingSoftwares(true);
            const params = new URLSearchParams();
            params.append('page', softwareCurrentPage.toString());
            params.append('per_page', softwarePerPage.toString());
            if (softwareSearch) {
                params.append('search', softwareSearch);
            }

            const response = await apiClient.get(`/computers/${id}/softwares?${params.toString()}`);
            setSoftwares(response.data.data || []);
            setSoftwarePagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || softwarePerPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error) {
            console.error('Falha ao buscar softwares:', error);
        } finally {
            setLoadingSoftwares(false);
        }
    };

    const handleSoftwareSearchChange = (value: string) => {
        setSoftwareSearch(value);
        setSoftwareCurrentPage(1);
    };

    const handleSoftwarePerPageChange = (value: string) => {
        setSoftwarePerPage(parseInt(value));
        setSoftwareCurrentPage(1);
    };

    const fetchActivities = async () => {
        if (!id) return;

        try {
            setLoadingActivities(true);
            const params = new URLSearchParams();
            params.append('page', activityCurrentPage.toString());
            params.append('per_page', activityPerPage.toString());

            const response = await apiClient.get(`/computers/${id}/activities?${params.toString()}`);
            setActivities(response.data.data || []);
            setActivityPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || activityPerPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error) {
            console.error('Falha ao buscar atividades:', error);
        } finally {
            setLoadingActivities(false);
        }
    };

    const handleActivityPerPageChange = (value: string) => {
        setActivityPerPage(parseInt(value));
        setActivityCurrentPage(1);
    };

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        parts.push(`${minutes}m`);

        return parts.join(' ');
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleCommand = async (command: string, params?: any) => {
        if (!id) return;
        try {
            // For immediate return commands like screenshot/ps_list, we might need to poll for status
            // But for now, let's assume async behavior and we poll separately or just fire and forget for control commands
            const res = await apiClient.post(`/computers/${id}/commands`, { command, parameters: params });

            if (command === 'screenshot' || command === 'ps_list' || command === 'update_agent') {
                toast({
                    title: command === 'update_agent' ? 'Atualização solicitada' : 'Solicitação enviada',
                    description: 'Aguardando resposta do agente...',
                });

                const cmdId = res.data.id;
                pollCommandResult(cmdId, command);

            } else {
                toast({
                    title: 'Comando enviado',
                    description: `O comando foi enviado com sucesso para a fila.`,
                });
            }

            setIsMessageOpen(false);
            setMessageText('');
        } catch (error: unknown) {
            console.error(error);
            const err = error as any;
            toast({
                title: 'Erro',
                description: err.response?.data?.message || 'Falha ao enviar comando.',
                variant: 'destructive',
            });
        }
    };

    const pollCommandResult = async (commandId: number, type: string) => {
        let attempts = 0;
        const maxAttempts = 10; // 20 seconds total

        const interval = setInterval(async () => {
            attempts++;
            try {
                // We need an endpoint to check specific command status. 
                // Currently we don't have a direct "GET /commands/{id}" in the frontend API easily accessible 
                // without modifying backend resource controller to show details freely.
                // However, the Agent calls "updateStatus".
                // Let's assume we can fetch the command status via the computer's pending/recent commands or a new endpoint.
                // For simplified Phase 1, we might just re-fetch the data we want if we knew where to look, 
                // but commands return output in the command object.
                // Let's rely on the list of commands for the computer.

                // Note: The correct way would be to GET /api/v1/commands/{id}, but we didn't add that to routes.
                // Let's use the list of commands for the computer and filter by ID since we are in the context of the computer.
                const res = await apiClient.get(`/computers/${id}/commands`);
                const cmd = res.data.data.find((c: any) => c.id === commandId);

                if (cmd && (cmd.status === 'completed' || cmd.status === 'failed')) {
                    clearInterval(interval);
                    if (cmd.status === 'completed') {
                        if (type === 'screenshot') {
                            setLastScreenshot(cmd.output);
                            toast({ title: 'Sucesso', description: 'Dados atualizados.' });
                        } else if (type === 'ps_list') {
                            try {
                                setProcesses(JSON.parse(cmd.output));
                            } catch (e) {
                                console.error("Error parsing process list", e);
                            }
                            toast({ title: 'Sucesso', description: 'Dados atualizados.' });
                        } else if (type === 'update_agent') {
                            toast({ title: 'Sucesso', description: 'O agente foi atualizado ou está em processo de atualização.' });
                        }
                    } else {
                        const failMsg = type === 'update_agent' && cmd.output
                            ? cmd.output
                            : 'O agente falhou ao executar o comando.';
                        toast({ title: 'Falha', description: failMsg, variant: 'destructive' });
                    }
                    if (type === 'screenshot') setLoadingScreenshot(false);
                    if (type === 'ps_list') setLoadingProcesses(false);
                }
            } catch (error) {
                console.error("Polling error", error);
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                if (type === 'screenshot') setLoadingScreenshot(false);
                if (type === 'ps_list') setLoadingProcesses(false);
                toast({ title: 'Timeout', description: 'O agente demorou muito para responder.', variant: 'destructive' });
            }
        }, 2000);
    };

    const fetchScreenshot = () => {
        setLoadingScreenshot(true);
        handleCommand('screenshot');
    };

    const fetchProcesses = () => {
        setLoadingProcesses(true);
        handleCommand('ps_list');
    };



    const handleTerminalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!terminalInput.trim()) return;

        const cmd = terminalInput;
        setTerminalInput('');
        setTerminalHistory(prev => [...prev, { type: 'command', content: cmd, timestamp: new Date() }]);
        setIsTerminalLoading(true);

        // We use the same handleCommand logic but we want to intercept the result specifically for terminal history
        // Since handleCommand is generic, we'll implement a specific call for terminal to easier state gathering
        if (!id) return;

        try {
            const res = await apiClient.post(`/computers/${id}/commands`, { command: 'terminal', parameters: { cmd_line: cmd } });
            const cmdId = res.data.id;

            // Poll specifically for this command
            let attempts = 0;
            const maxAttempts = 15; // 30 seconds

            const interval = setInterval(async () => {
                attempts++;
                try {
                    const res = await apiClient.get(`/computers/${id}/commands`);
                    const commandObj = res.data.data.find((c: any) => c.id === cmdId);

                    if (commandObj && (commandObj.status === 'completed' || commandObj.status === 'failed')) {
                        clearInterval(interval);
                        setIsTerminalLoading(false);
                        if (commandObj.status === 'completed') {
                            setTerminalHistory(prev => [...prev, { type: 'output', content: commandObj.output || '[No Output]', timestamp: new Date() }]);
                        } else {
                            setTerminalHistory(prev => [...prev, { type: 'error', content: commandObj.output || 'Command failed', timestamp: new Date() }]);
                        }
                    }
                } catch (err) {
                    console.error("Terminal poll error", err);
                }

                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    setIsTerminalLoading(false);
                    setTerminalHistory(prev => [...prev, { type: 'error', content: 'Timeout waiting for response', timestamp: new Date() }]);
                }
            }, 2000);

        } catch (error: any) {
            setIsTerminalLoading(false);
            setTerminalHistory(prev => [...prev, { type: 'error', content: error.message || 'Failed to send command', timestamp: new Date() }]);
        }
    };

    const handleRotateHash = async () => {
        if (!id) return;
        try {
            const response = await apiClient.post(`/computers/${id}/rotate-hash`);
            setComputer(prev => prev ? { ...prev, public_hash: response.data.public_hash } : null);
            toast({
                title: 'Sucesso',
                description: 'Link público rotacionado com sucesso. O link anterior foi invalidado.',
            });
        } catch (error: unknown) {
            console.error(error);
            const err = error as any; // Temporary cast for accessing response
            toast({
                title: 'Erro',
                description: err.response?.data?.message || 'Falha ao rotacionar link público.',
                variant: 'destructive',
            });
        }
    };

    const sortedProcesses = processes
        .filter(p => p.name.toLowerCase().includes(processSearch.toLowerCase()) || p.pid.toString().includes(processSearch))
        .sort((a, b) => {
            let valA = a[processSort === 'cpu' ? 'cpu_percent' : processSort === 'memory' ? 'memory_percent' : 'name'];
            let valB = b[processSort === 'cpu' ? 'cpu_percent' : processSort === 'memory' ? 'memory_percent' : 'name'];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return processSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return processSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    const toggleSort = (field: 'cpu' | 'memory' | 'name') => {
        if (processSort === field) {
            setProcessSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setProcessSort(field);
            setProcessSortDirection('desc'); // Default to desc for metrics
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Carregando...</div>
            </div>
        );
    }

    if (!computer) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-red-500">Computador não encontrado</div>
            </div>
        );
    }

    // Use shared utility function for consistency
    const isOnline = isComputerOnline(computer.updated_at, 5);
    const latestMetric = metrics.length > 0 ? metrics[0] : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <button
                        onClick={() => navigate('/admin/computers')}
                        className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
                    >
                        ← Voltar para Computadores
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {computer.hostname || computer.machine_id}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span
                            className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                        />
                        <span className="text-sm text-gray-600">
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className="text-sm text-gray-500">
                            • Última atualização: {new Date(computer.updated_at).toLocaleString('pt-BR')}
                        </span>
                    </div>
                </div>

                {/* Remote Actions */}
                <div className="flex flex-wrap gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                <Power className="h-4 w-4 mr-2" />
                                Desligar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Isso enviará um comando para desligar o computador imediatamente.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleCommand('shutdown')} className="bg-red-600 hover:bg-red-700">
                                    Desligar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline">
                                <RotateCw className="h-4 w-4 mr-2" />
                                Reiniciar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Reiniciar computador?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    O computador será reiniciado. Certifique-se que não há trabalho não salvo.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleCommand('restart')}>
                                    Reiniciar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button variant="outline" onClick={() => handleCommand('lock')}>
                        <Lock className="h-4 w-4 mr-2" />
                        Bloquear
                    </Button>

                    <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Mensagem
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Enviar Mensagem para o Usuário</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                <Label htmlFor="message" className="mb-2 block">Mensagem</Label>
                                <Input
                                    id="message"
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    placeholder="Ex: O laboratório será fechado em 10 minutos."
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsMessageOpen(false)}>Cancelar</Button>
                                <Button onClick={() => handleCommand('message', { message: messageText })}>Enviar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {!isOnline && (
                        <Button variant="outline" onClick={() => handleCommand('wol')} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                            <Zap className="h-4 w-4 mr-2" />
                            Acordar (WoL)
                        </Button>
                    )}
                </div>
            </div>

            {/* Live Metrics */}
            {latestMetric && (
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" />
                            <h2 className="text-lg font-semibold">Monitoramento em Tempo Real</h2>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            Atualizado: {new Date(latestMetric.recorded_at).toLocaleTimeString()}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* CPU */}
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">CPU</span>
                                <span className="text-sm font-bold text-gray-900">{latestMetric.cpu_usage_percent.toFixed(1)}%</span>
                            </div>
                            <Progress value={latestMetric.cpu_usage_percent} className="h-2" />
                        </div>

                        {/* Memory */}
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Memória</span>
                                <span className="text-sm font-bold text-gray-900">{latestMetric.memory_usage_percent.toFixed(1)}%</span>
                            </div>
                            <Progress value={latestMetric.memory_usage_percent} className="h-2" />
                            <div className="flex justify-between mt-2 text-xs text-gray-500">
                                <span>Livre: {latestMetric.memory_free_gb.toFixed(1)} GB</span>
                                <span>Total: {latestMetric.memory_total_gb.toFixed(1)} GB</span>
                            </div>
                        </div>

                        {/* Uptime & Processes */}
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
                            <div className="flex items-center gap-3 mb-3">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Uptime</p>
                                    <p className="text-sm font-bold text-gray-900">{formatUptime(latestMetric.uptime_seconds)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Activity className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Processos</p>
                                    <p className="text-sm font-bold text-gray-900">{latestMetric.processes_count}</p>
                                </div>
                            </div>
                        </div>

                        {/* Network */}
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-100">
                            <h3 className="text-xs font-medium text-gray-500 mb-2">Rede (Total)</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-green-600">↓ Download</span>
                                    <span className="font-mono">{formatBytes(latestMetric.network_stats?.bytes_recv || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-blue-600">↑ Upload</span>
                                    <span className="font-mono">{formatBytes(latestMetric.network_stats?.bytes_sent || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Disks */}
                    {latestMetric.disk_usage && latestMetric.disk_usage.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Armazenamento</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {latestMetric.disk_usage.map((disk: any, idx: number) => (
                                    <div key={idx} className="bg-gray-50 rounded-md p-3 border border-gray-100 flex items-center gap-4">
                                        <HardDrive className="h-8 w-8 text-gray-400" />
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-medium text-sm">{disk.mount}</span>
                                                <span className="text-xs text-gray-500">{disk.percent}%</span>
                                            </div>
                                            <Progress value={disk.percent} className="h-1.5" />
                                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                                                <span>Livre: {disk.free_gb} GB</span>
                                                <span>Total: {disk.total_gb} GB</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Tabs defaultValue="general" className="w-full">
                <TabsList>
                    <TabsTrigger value="general">Geral</TabsTrigger>
                    <TabsTrigger value="supervision">Supervisão (Beta)</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-lg font-semibold mb-4">Informações Básicas</h2>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-500">ID da Máquina</dt>
                                <dd className="mt-1 text-sm text-gray-900 font-mono">{computer.machine_id}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Hostname</dt>
                                <dd className="mt-1 text-sm text-gray-900">{computer.hostname || 'N/A'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Laboratório</dt>
                                <dd className="mt-1 text-sm text-gray-900">{computer.lab.name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Registrado em</dt>
                                <dd className="mt-1 text-sm text-gray-900">
                                    {new Date(computer.created_at).toLocaleString('pt-BR')}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* QR Code Section */}
                    {computer.public_hash && (
                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <QrCode className="h-5 w-5 text-gray-700" />
                                <h2 className="text-lg font-semibold">QR Code e Link Público</h2>
                            </div>
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex-1">
                                    <QRCodeDisplay
                                        value={`${window.location.origin}/public/pc/${computer.public_hash}`}
                                        size={200}
                                        title="QR Code para Acesso Público"
                                    />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Link Público
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={`${window.location.origin}/public/pc/${computer.public_hash}`}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={async () => {
                                                    const publicUrl = `${window.location.origin}/public/pc/${computer.public_hash}`;
                                                    const ok = await copyToClipboard(publicUrl);
                                                    if (ok) {
                                                        toast({
                                                            title: 'Link copiado!',
                                                            description: 'O link público foi copiado para a área de transferência.',
                                                        });
                                                    } else {
                                                        toast({
                                                            title: 'Erro',
                                                            description: 'Não foi possível copiar o link. Tente selecionar e copiar manualmente.',
                                                            variant: 'destructive',
                                                        });
                                                    }
                                                }}
                                            >
                                                <Copy className="h-4 w-4 mr-2" />
                                                Copiar
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50">
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                        Rotacionar
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Rotacionar Hash Público?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Isso irá invalidar o link público atual imediatamente. Qualquer pessoa usando o link antigo perderá o acesso.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleRotateHash}>
                                                            Confirmar Rotação
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Baixar QR Code
                                        </label>
                                        <Button
                                            variant="outline"
                                            onClick={async () => {
                                                try {
                                                    const response = await apiClient.get(
                                                        `/computers/${computer.id}/qrcode`,
                                                        { responseType: 'blob' }
                                                    );
                                                    const url = window.URL.createObjectURL(new Blob([response.data]));
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.setAttribute('download', `qrcode-${computer.hostname || computer.machine_id}.png`);
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    link.remove();
                                                    window.URL.revokeObjectURL(url);
                                                    toast({
                                                        title: 'Download iniciado!',
                                                        description: 'O QR code foi baixado com sucesso.',
                                                    });
                                                } catch (error) {
                                                    toast({
                                                        title: 'Erro',
                                                        description: 'Não foi possível baixar o QR code.',
                                                        variant: 'destructive',
                                                    });
                                                }
                                            }}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Baixar QR Code (PNG)
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hardware Info */}
                    {computer.hardware_info && (
                        <div className="bg-white shadow rounded-lg p-6">
                            <h2 className="text-lg font-semibold mb-4">Informações de Hardware</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* CPU */}
                                {computer.hardware_info.cpu && (
                                    <div className="border-l-4 border-blue-500 pl-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Cpu className="h-5 w-5 text-blue-500" />
                                            <h3 className="text-sm font-medium text-gray-700">CPU</h3>
                                        </div>
                                        <dl className="space-y-1">
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Processador:</dt>
                                                <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.cpu.processor || 'N/A'}</dd>
                                            </div>
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Núcleos Físicos:</dt>
                                                <dd className="text-sm text-gray-900">{computer.hardware_info.cpu.physical_cores || 'N/A'}</dd>
                                            </div>
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Núcleos Lógicos:</dt>
                                                <dd className="text-sm text-gray-900">{computer.hardware_info.cpu.logical_cores || 'N/A'}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                )}

                                {/* Memory */}
                                {computer.hardware_info.memory && (
                                    <div className="border-l-4 border-green-500 pl-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MemoryStick className="h-5 w-5 text-green-500" />
                                            <h3 className="text-sm font-medium text-gray-700">Memória</h3>
                                        </div>
                                        <dl className="space-y-1">
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Total:</dt>
                                                <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.memory.total_gb || 'N/A'} GB</dd>
                                            </div>
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Disponível:</dt>
                                                <dd className="text-sm text-gray-900">{computer.hardware_info.memory.available_gb || 'N/A'} GB</dd>
                                            </div>
                                        </dl>
                                    </div>
                                )}

                                {/* Disk */}
                                {computer.hardware_info.disk && (
                                    <div className="border-l-4 border-purple-500 pl-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <HardDrive className="h-5 w-5 text-purple-500" />
                                            <h3 className="text-sm font-medium text-gray-700">Armazenamento</h3>
                                        </div>
                                        <dl className="space-y-1">
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Total:</dt>
                                                <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.disk.total_gb || 'N/A'} GB</dd>
                                            </div>
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Usado:</dt>
                                                <dd className="text-sm text-gray-900">{computer.hardware_info.disk.used_gb || 'N/A'} GB</dd>
                                            </div>
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Livre:</dt>
                                                <dd className="text-sm text-gray-900">{computer.hardware_info.disk.free_gb || 'N/A'} GB</dd>
                                            </div>
                                        </dl>
                                    </div>
                                )}

                                {/* Network Interfaces */}
                                {computer.hardware_info.network && computer.hardware_info.network.length > 0 && (
                                    <div className="border-l-4 border-cyan-500 pl-4 col-span-1 md:col-span-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Network className="h-5 w-5 text-cyan-500" />
                                            <h3 className="text-sm font-medium text-gray-700">Interfaces de Rede</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {computer.hardware_info.network.map((iface, idx) => (
                                                <div key={idx} className="bg-gray-50 p-2 rounded text-xs border border-gray-100">
                                                    <p className="font-semibold text-gray-700 mb-1">{iface.name}</p>
                                                    {iface.mac && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">MAC:</span>
                                                            <span className="font-mono">{iface.mac}</span>
                                                        </div>
                                                    )}
                                                    {iface.ipv4.length > 0 && (
                                                        <div className="flex justify-between mt-1">
                                                            <span className="text-gray-500">IPv4:</span>
                                                            <span className="font-mono text-right">{iface.ipv4.join(', ')}</span>
                                                        </div>
                                                    )}
                                                    {iface.ipv6.length > 0 && (
                                                        <div className="mt-1">
                                                            <span className="text-gray-500 block">IPv6:</span>
                                                            <span className="font-mono text-[10px] break-all">{iface.ipv6[0]}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* OS */}
                                {computer.hardware_info.os && (
                                    <div className="border-l-4 border-orange-500 pl-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MonitorIcon className="h-5 w-5 text-orange-500" />
                                            <h3 className="text-sm font-medium text-gray-700">Sistema Operacional</h3>
                                        </div>
                                        <dl className="space-y-1">
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Sistema:</dt>
                                                <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.os.system || 'N/A'}</dd>
                                            </div>
                                            <div className="flex justify-between">
                                                <dt className="text-sm text-gray-500">Versão:</dt>
                                                <dd className="text-sm text-gray-900">{computer.hardware_info.os.release || 'N/A'}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Agent Version */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Code2 className="h-5 w-5 text-gray-700" />
                                <h2 className="text-lg font-semibold">Agente</h2>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Versão do agente instalada</p>
                                    <p className="text-lg font-medium">
                                        {computer.agent_version || 'Desconhecida'}
                                    </p>
                                </div>
                                {computer.agent_version && computer.latest_agent_version && (
                                    <div className="flex items-center gap-2">
                                        {computer.agent_version === computer.latest_agent_version ? (
                                            <Badge className="bg-green-500">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Atualizado
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-yellow-500">
                                                <AlertCircle className="h-3 w-3 mr-1" />
                                                Desatualizado
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                            {computer.latest_agent_version && (
                                <div>
                                    <p className="text-sm text-gray-500">Versão mais recente disponível</p>
                                    <p className="text-sm font-medium">{computer.latest_agent_version}</p>
                                </div>
                            )}
                            {computer.agent_version && 
                             computer.latest_agent_version && 
                             computer.agent_version !== computer.latest_agent_version && (
                                <div className="pt-2 border-t">
                                    <Button
                                        size="sm"
                                        onClick={() => handleCommand('update_agent')}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Atualizar agente
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Installed Software */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Package className="h-5 w-5 text-gray-700" />
                            <h2 className="text-lg font-semibold">
                                Software Instalado {softwarePagination && `(${softwarePagination.total})`}
                            </h2>
                        </div>

                        {/* Search and Per Page */}
                        <div className="flex gap-4 items-center mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    placeholder="Buscar por nome, versão ou fabricante..."
                                    className="pl-10"
                                    value={softwareSearch}
                                    onChange={(e) => handleSoftwareSearchChange(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                                <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                                <Select value={softwarePerPage.toString()} onValueChange={handleSoftwarePerPageChange}>
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingSoftwares ? (
                            <div className="flex justify-center items-center h-32">
                                <div className="text-gray-500">Carregando softwares...</div>
                            </div>
                        ) : softwares.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {softwares.map((software) => (
                                        <div
                                            key={software.id}
                                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
                                                    {software.name}
                                                </h3>
                                                <Package className="h-5 w-5 text-blue-500 flex-shrink-0 ml-2" />
                                            </div>

                                            {software.version && (
                                                <div className="mb-2">
                                                    <span className="text-xs text-gray-500">Versão:</span>
                                                    <span className="ml-2 text-sm font-medium text-gray-700">
                                                        {software.version}
                                                    </span>
                                                </div>
                                            )}

                                            {software.vendor && (
                                                <div className="mb-2">
                                                    <span className="text-xs text-gray-500">Fabricante:</span>
                                                    <span className="ml-2 text-sm text-gray-700">
                                                        {software.vendor}
                                                    </span>
                                                </div>
                                            )}

                                            {software.pivot?.installed_at && (
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <span className="text-xs text-gray-500">
                                                        Instalado em: {new Date(software.pivot.installed_at).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {softwarePagination && softwarePagination.last_page > 1 && (
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="text-sm text-gray-700">
                                            Mostrando {softwarePagination.from} a {softwarePagination.to} de {softwarePagination.total} softwares
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSoftwareCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={softwareCurrentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Anterior
                                            </Button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(5, softwarePagination.last_page) }, (_, i) => {
                                                    let pageNum;
                                                    if (softwarePagination.last_page <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (softwareCurrentPage <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (softwareCurrentPage >= softwarePagination.last_page - 2) {
                                                        pageNum = softwarePagination.last_page - 4 + i;
                                                    } else {
                                                        pageNum = softwareCurrentPage - 2 + i;
                                                    }
                                                    return (
                                                        <Button
                                                            key={pageNum}
                                                            variant={softwareCurrentPage === pageNum ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => setSoftwareCurrentPage(pageNum)}
                                                            className="min-w-[40px]"
                                                        >
                                                            {pageNum}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSoftwareCurrentPage(prev => Math.min(softwarePagination.last_page, prev + 1))}
                                                disabled={softwareCurrentPage === softwarePagination.last_page}
                                            >
                                                Próxima
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Info when no pagination needed */}
                                {softwarePagination && softwarePagination.last_page === 1 && (
                                    <div className="mt-4 text-sm text-gray-500">
                                        Mostrando {softwarePagination.total} {softwarePagination.total === 1 ? 'software' : 'softwares'}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">
                                    {softwareSearch ? 'Nenhum software encontrado com sua busca' : 'Nenhuma informação de software disponível'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Activity History */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">
                                Histórico de Atividades {activityPagination && `(${activityPagination.total})`}
                            </h2>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                                <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                                <Select value={activityPerPage.toString()} onValueChange={handleActivityPerPageChange}>
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingActivities ? (
                            <div className="flex justify-center items-center h-32">
                                <div className="text-gray-500">Carregando atividades...</div>
                            </div>
                        ) : activities.length > 0 ? (
                            <>
                                <div className="space-y-3">
                                    {activities.map((activity) => (
                                        <div key={activity.id} className="border-l-4 border-blue-500 pl-4 py-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Tipo: {activity.type}</p>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(activity.created_at).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {activityPagination && activityPagination.last_page > 1 && (
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="text-sm text-gray-700">
                                            Mostrando {activityPagination.from} a {activityPagination.to} de {activityPagination.total} atividades
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActivityCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={activityCurrentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Anterior
                                            </Button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(5, activityPagination.last_page) }, (_, i) => {
                                                    let pageNum;
                                                    if (activityPagination.last_page <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (activityCurrentPage <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (activityCurrentPage >= activityPagination.last_page - 2) {
                                                        pageNum = activityPagination.last_page - 4 + i;
                                                    } else {
                                                        pageNum = activityCurrentPage - 2 + i;
                                                    }
                                                    return (
                                                        <Button
                                                            key={pageNum}
                                                            variant={activityCurrentPage === pageNum ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => setActivityCurrentPage(pageNum)}
                                                            className="min-w-[40px]"
                                                        >
                                                            {pageNum}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActivityCurrentPage(prev => Math.min(activityPagination.last_page, prev + 1))}
                                                disabled={activityCurrentPage === activityPagination.last_page}
                                            >
                                                Próxima
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Info when no pagination needed */}
                                {activityPagination && activityPagination.last_page === 1 && (
                                    <div className="mt-4 text-sm text-gray-500">
                                        Mostrando {activityPagination.total} {activityPagination.total === 1 ? 'atividade' : 'atividades'}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-gray-500 text-sm">Nenhum histórico de atividades disponível</p>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="supervision" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Remote Screen */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Eye className="h-5 w-5 text-blue-600" />
                                    <h2 className="text-lg font-semibold">Live Screen</h2>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            checked={autoRefreshScreen}
                                            onChange={(e) => setAutoRefreshScreen(e.target.checked)}
                                        />
                                        Auto-refresh (5s)
                                    </label>
                                    <Button size="sm" onClick={fetchScreenshot} disabled={loadingScreenshot}>
                                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingScreenshot ? 'animate-spin' : ''}`} />
                                        Atualizar
                                    </Button>
                                </div>
                            </div>

                            <div className="border rounded-lg bg-gray-900 flex items-center justify-center min-h-[300px] aspect-video overflow-hidden">
                                {lastScreenshot ? (
                                    <img
                                        src={`data:image/jpeg;base64,${lastScreenshot}`}
                                        alt="Remote Screen"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-gray-500 text-sm flex flex-col items-center">
                                        <Eye className="h-10 w-10 mb-2 opacity-20" />
                                        Clique em Atualizar para ver a tela
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Process Manager */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-green-600" />
                                    <h2 className="text-lg font-semibold">Gerenciador de Processos</h2>
                                </div>
                                <Button size="sm" onClick={fetchProcesses} disabled={loadingProcesses}>
                                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingProcesses ? 'animate-spin' : ''}`} />
                                    Listar
                                </Button>
                            </div>

                            <div className="mb-4">
                                <Input
                                    placeholder="Buscar processo (Nome ou PID)..."
                                    value={processSearch}
                                    onChange={(e) => setProcessSearch(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-900"
                                />
                            </div>

                            <div className="border rounded-lg overflow-hidden flex flex-col h-[500px]">
                                {processes.length > 0 ? (
                                    <div className="overflow-auto flex-1">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('name')}>
                                                        <div className="flex items-center gap-1">
                                                            Nome {processSort === 'name' && (processSortDirection === 'asc' ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>)}
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">PID</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('cpu')}>
                                                        <div className="flex items-center gap-1">
                                                            CPU% {processSort === 'cpu' && (processSortDirection === 'asc' ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>)}
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('memory')}>
                                                        <div className="flex items-center gap-1">
                                                            RAM% {processSort === 'memory' && (processSortDirection === 'asc' ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>)}
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {sortedProcesses.map((proc, idx) => (
                                                    <tr key={`${proc.pid}-${idx}`} className="hover:bg-blue-50/50 transition-colors text-xs group">
                                                        <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[150px]" title={proc.name}>{proc.name}</td>
                                                        <td className="px-3 py-2 font-mono text-gray-500">{proc.pid}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-700 w-8">{proc.cpu_percent?.toFixed(1)}%</span>
                                                                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${proc.cpu_percent > 50 ? 'bg-red-500' : 'bg-green-500'}`}
                                                                        style={{ width: `${Math.min(100, proc.cpu_percent)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-500">{proc.memory_percent?.toFixed(1)}%</td>
                                                        <td className="px-3 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <button
                                                                        className="text-red-500 hover:text-red-700 hover:bg-red-100 p-1.5 rounded-full transition-colors"
                                                                        title="Matar Processo"
                                                                    >
                                                                        <Ban className="h-4 w-4" />
                                                                    </button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <div className="flex items-center gap-2 text-red-600">
                                                                            <Ban className="h-6 w-6" />
                                                                            <AlertDialogTitle>Finalizar Processo?</AlertDialogTitle>
                                                                        </div>
                                                                        <AlertDialogDescription className="space-y-2 pt-2">
                                                                            <p>Tem certeza que deseja finalizar o processo:</p>
                                                                            <div className="bg-red-50 p-3 rounded-md border border-red-100 text-red-900 font-mono text-sm">
                                                                                {proc.name} (PID: {proc.pid})
                                                                            </div>
                                                                            <p className="text-yellow-600 text-xs">Atenção: Finalizar processos do sistema pode causar instabilidade.</p>
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleCommand('ps_kill', { pid: proc.pid })} className="bg-red-600 hover:bg-red-700 text-white">
                                                                            Finalizar
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
                                        {loadingProcesses ? 'Carregando...' : 'Nenhum processo listado'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Remote Terminal */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Terminal className="h-5 w-5 text-gray-800" />
                                <h2 className="text-lg font-semibold">Terminal Remoto (Shell)</h2>
                            </div>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                Acesso Root/System
                            </Badge>
                        </div>

                        <div className="bg-[#1e1e1e] rounded-lg p-4 font-mono text-sm h-[400px] flex flex-col shadow-inner border border-gray-800">
                            <div className="flex-1 overflow-auto space-y-1 mb-4 pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                {terminalHistory.length === 0 && (
                                    <div className="text-gray-500 italic select-none">
                                        &gt; Conectado ao terminal remoto.{'\n'}
                                        &gt; Digite um comando para começar (ex: 'dir', 'ipconfig', 'ls')...
                                    </div>
                                )}
                                {terminalHistory.map((entry, idx) => (
                                    <div key={idx} className="whitespace-pre-wrap break-all">
                                        {entry.type === 'command' ? (
                                            <div className="flex items-start text-blue-400 mt-2">
                                                <span className="mr-2 select-none font-bold">$</span>
                                                <span>{entry.content}</span>
                                                <span className="ml-auto text-[10px] text-gray-600 select-none opacity-50">{entry.timestamp.toLocaleTimeString()}</span>
                                            </div>
                                        ) : entry.type === 'error' ? (
                                            <div className="text-red-400 pl-4 border-l-2 border-red-900/50 my-1">
                                                {entry.content}
                                            </div>
                                        ) : (
                                            <div className="text-gray-300 pl-4 my-1">
                                                {entry.content}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isTerminalLoading && (
                                    <div className="flex items-center gap-2 text-gray-500 mt-2 pl-4">
                                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></span>
                                        <span>Executando...</span>
                                    </div>
                                )}
                                <div id="terminal-end" />
                            </div>

                            <form onSubmit={handleTerminalSubmit} className="flex gap-2 items-center bg-[#2d2d2d] p-2 rounded border border-gray-700">
                                <span className="text-green-500 font-bold select-none">$</span>
                                <input
                                    type="text"
                                    value={terminalInput}
                                    onChange={(e) => setTerminalInput(e.target.value)}
                                    className="flex-1 bg-transparent text-gray-200 focus:outline-none placeholder-gray-600 font-mono"
                                    placeholder="Execute um comando..."
                                    autoComplete="off"
                                    autoFocus
                                />
                                <Button type="submit" size="sm" className="h-7 bg-gray-700 hover:bg-gray-600 text-xs text-gray-200" disabled={!terminalInput.trim() || isTerminalLoading}>
                                    Executar
                                </Button>
                            </form>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
