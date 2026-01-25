import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Copy, Download, QrCode, ChevronLeft, ChevronRight, Search, Package, Cpu, MemoryStick, HardDrive, Monitor as MonitorIcon, Activity, Clock, Network, Power, RotateCw, Lock, MessageSquare, Zap } from 'lucide-react';
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
            await apiClient.post(`/computers/${id}/commands`, { command, parameters: params });
            toast({
                title: 'Comando enviado',
                description: `O comando foi enviado com sucesso para a fila.`,
            });
            setIsMessageOpen(false);
            setMessageText('');
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Erro',
                description: error.response?.data?.message || 'Falha ao enviar comando.',
                variant: 'destructive',
            });
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

    const isOnline = new Date().getTime() - new Date(computer.updated_at).getTime() < 5 * 60 * 1000;
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
                                            try {
                                                await navigator.clipboard.writeText(publicUrl);
                                                toast({
                                                    title: 'Link copiado!',
                                                    description: 'O link público foi copiado para a área de transferência.',
                                                });
                                            } catch (err) {
                                                toast({
                                                    title: 'Erro',
                                                    description: 'Não foi possível copiar o link.',
                                                    variant: 'destructive',
                                                });
                                            }
                                        }}
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copiar
                                    </Button>
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
        </div>
    );
}
