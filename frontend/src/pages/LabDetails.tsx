import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { 
    ChevronLeft, 
    ChevronRight, 
    Search, 
    Package, 
    Monitor, 
    Cpu, 
    HardDrive, 
    MemoryStick,
    Activity,
    Server,
    MoreVertical,
    Power,
    RotateCw,
    MessageSquare,
    Zap
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface HardwareAverages {
    cpu?: {
        avg_physical_cores?: number;
        avg_logical_cores?: number;
    };
    memory?: {
        avg_total_gb?: number;
    };
    disk?: {
        avg_total_gb?: number;
        avg_used_gb?: number;
        avg_free_gb?: number;
        avg_usage_percent?: number;
    };
    computers_with_hardware_info?: number;
}

interface OSDistribution {
    system: string;
    release: string;
    count: number;
}

interface LabStats {
    total_computers: number;
    online_computers: number;
    offline_computers: number;
    total_softwares: number;
    hardware_averages: HardwareAverages | null;
    os_distribution: OSDistribution[];
}

interface Lab {
    id: number;
    name: string;
    description: string;
    created_at: string;
}

interface Computer {
    id: number;
    machine_id: string;
    hostname: string | null;
    lab?: {
        id: number;
        name: string;
    };
    created_at: string;
    updated_at: string;
}

interface Software {
    id: number;
    name: string;
    version: string | null;
    vendor: string | null;
    computers_count?: number;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export default function LabDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [lab, setLab] = useState<Lab | null>(null);
    const [stats, setStats] = useState<LabStats | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Computers state
    const [computers, setComputers] = useState<Computer[]>([]);
    const [computerSearch, setComputerSearch] = useState('');
    const [computerCurrentPage, setComputerCurrentPage] = useState(1);
    const [computerPerPage, setComputerPerPage] = useState(20);
    const [computerPagination, setComputerPagination] = useState<PaginationMeta | null>(null);
    const [computerStatusFilter, setComputerStatusFilter] = useState<string>('all');
    const [loadingComputers, setLoadingComputers] = useState(false);
    
    // Softwares state
    const [softwares, setSoftwares] = useState<Software[]>([]);
    const [softwareSearch, setSoftwareSearch] = useState('');
    const [softwareCurrentPage, setSoftwareCurrentPage] = useState(1);
    const [softwarePerPage, setSoftwarePerPage] = useState(20);
    const [softwarePagination, setSoftwarePagination] = useState<PaginationMeta | null>(null);
    const [loadingSoftwares, setLoadingSoftwares] = useState(false);
    
    // Actions state
    const [isLabMessageOpen, setIsLabMessageOpen] = useState(false);
    const [labMessageText, setLabMessageText] = useState('');
    const [confirmAction, setConfirmAction] = useState<{ command: string, title: string, description: string } | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (id) {
            fetchLabDetails();
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchComputers();
        }
    }, [id, computerCurrentPage, computerPerPage, computerSearch, computerStatusFilter]);

    useEffect(() => {
        if (id) {
            fetchSoftwares();
        }
    }, [id, softwareCurrentPage, softwarePerPage, softwareSearch]);

    const fetchLabDetails = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/labs/${id}`);
            setLab(response.data.lab);
            setStats(response.data.stats);
        } catch (error) {
            console.error('Falha ao buscar detalhes do laboratório:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchComputers = async () => {
        if (!id) return;
        
        try {
            setLoadingComputers(true);
            const params = new URLSearchParams();
            params.append('page', computerCurrentPage.toString());
            params.append('per_page', computerPerPage.toString());
            if (computerSearch) {
                params.append('search', computerSearch);
            }
            if (computerStatusFilter !== 'all') {
                params.append('status', computerStatusFilter);
            }

            const response = await apiClient.get(`/labs/${id}/computers?${params.toString()}`);
            setComputers(response.data.data || []);
            setComputerPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || computerPerPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error) {
            console.error('Falha ao buscar computadores:', error);
        } finally {
            setLoadingComputers(false);
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

            const response = await apiClient.get(`/labs/${id}/softwares?${params.toString()}`);
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

    const handleLabCommand = async (command: string, params: any = {}) => {
        if (!id) return;
        try {
            await apiClient.post(`/labs/${id}/commands`, { command, parameters: params });
            toast({
                title: 'Comando enviado',
                description: `Comando enviado para todos os computadores do laboratório.`,
            });
            setIsLabMessageOpen(false);
            setLabMessageText('');
            setConfirmAction(null);
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.response?.data?.message || 'Falha ao enviar comando.',
                variant: 'destructive',
            });
        }
    };

    const handleComputerSearchChange = (value: string) => {
        setComputerSearch(value);
        setComputerCurrentPage(1);
    };

    const handleComputerPerPageChange = (value: string) => {
        setComputerPerPage(parseInt(value));
        setComputerCurrentPage(1);
    };

    const handleSoftwareSearchChange = (value: string) => {
        setSoftwareSearch(value);
        setSoftwareCurrentPage(1);
    };

    const handleSoftwarePerPageChange = (value: string) => {
        setSoftwarePerPage(parseInt(value));
        setSoftwareCurrentPage(1);
    };

    const isOnline = (updatedAt: string) => {
        const date = new Date(updatedAt);
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000 / 60; // minutes
        return diff < 5;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Carregando...</div>
            </div>
        );
    }

    if (!lab || !stats) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-red-500">Laboratório não encontrado</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate('/admin/labs')}
                        className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
                    >
                        ← Voltar para Laboratórios
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">{lab.name}</h1>
                    {lab.description && (
                        <p className="text-gray-600 mt-1">{lab.description}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                        Criado em: {new Date(lab.created_at).toLocaleString('pt-BR')}
                    </p>
                </div>
                
                <div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                Ações em Massa <MoreVertical className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setConfirmAction({ command: 'shutdown', title: 'Desligar Laboratório', description: 'Isso enviará um comando para desligar TODOS os computadores deste laboratório imediatamente.' })} className="text-red-600 focus:text-red-600">
                                <Power className="mr-2 h-4 w-4" /> Desligar Todos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setConfirmAction({ command: 'restart', title: 'Reiniciar Laboratório', description: 'Isso enviará um comando para reiniciar TODOS os computadores deste laboratório.' })}>
                                <RotateCw className="mr-2 h-4 w-4" /> Reiniciar Todos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLabCommand('wol')}>
                                <Zap className="mr-2 h-4 w-4" /> Acordar Todos (WoL)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsLabMessageOpen(true)}>
                                <MessageSquare className="mr-2 h-4 w-4" /> Enviar Mensagem
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Confirmation Dialog */}
                    <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {confirmAction?.description}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={() => confirmAction && handleLabCommand(confirmAction.command)}
                                    className={confirmAction?.command === 'shutdown' ? 'bg-red-600 hover:bg-red-700' : ''}
                                >
                                    Confirmar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Message Dialog */}
                    <Dialog open={isLabMessageOpen} onOpenChange={setIsLabMessageOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Enviar Mensagem para o Laboratório</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                <Label htmlFor="lab-message" className="mb-2 block">Mensagem</Label>
                                <Input
                                    id="lab-message"
                                    value={labMessageText}
                                    onChange={(e) => setLabMessageText(e.target.value)}
                                    placeholder="Ex: O laboratório será fechado em 10 minutos."
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsLabMessageOpen(false)}>Cancelar</Button>
                                <Button onClick={() => handleLabCommand('message', { message: labMessageText })}>Enviar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total de Computadores</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_computers}</p>
                        </div>
                        <Monitor className="h-8 w-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Online</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{stats.online_computers}</p>
                        </div>
                        <Activity className="h-8 w-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Offline</p>
                            <p className="text-2xl font-bold text-gray-500 mt-1">{stats.offline_computers}</p>
                        </div>
                        <Monitor className="h-8 w-8 text-gray-400" />
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Softwares Únicos</p>
                            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.total_softwares}</p>
                        </div>
                        <Package className="h-8 w-8 text-purple-500" />
                    </div>
                </div>
            </div>

            {/* Hardware Averages */}
            {stats.hardware_averages && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Médias de Configuração</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* CPU */}
                        {stats.hardware_averages.cpu && (
                            <div className="border-l-4 border-blue-500 pl-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Cpu className="h-5 w-5 text-blue-500" />
                                    <h3 className="text-sm font-medium text-gray-700">CPU</h3>
                                </div>
                                <dl className="space-y-1">
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Núcleos Físicos (média):</dt>
                                        <dd className="text-sm text-gray-900 font-medium">
                                            {stats.hardware_averages.cpu.avg_physical_cores?.toFixed(2) || 'N/A'}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Núcleos Lógicos (média):</dt>
                                        <dd className="text-sm text-gray-900 font-medium">
                                            {stats.hardware_averages.cpu.avg_logical_cores?.toFixed(2) || 'N/A'}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        )}

                        {/* Memory */}
                        {stats.hardware_averages.memory && (
                            <div className="border-l-4 border-green-500 pl-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MemoryStick className="h-5 w-5 text-green-500" />
                                    <h3 className="text-sm font-medium text-gray-700">Memória</h3>
                                </div>
                                <dl className="space-y-1">
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Total (média):</dt>
                                        <dd className="text-sm text-gray-900 font-medium">
                                            {stats.hardware_averages.memory.avg_total_gb?.toFixed(2) || 'N/A'} GB
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        )}

                        {/* Disk */}
                        {stats.hardware_averages.disk && (
                            <div className="border-l-4 border-purple-500 pl-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <HardDrive className="h-5 w-5 text-purple-500" />
                                    <h3 className="text-sm font-medium text-gray-700">Armazenamento</h3>
                                </div>
                                <dl className="space-y-1">
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Total (média):</dt>
                                        <dd className="text-sm text-gray-900 font-medium">
                                            {stats.hardware_averages.disk.avg_total_gb?.toFixed(2) || 'N/A'} GB
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Usado (média):</dt>
                                        <dd className="text-sm text-gray-900">
                                            {stats.hardware_averages.disk.avg_used_gb?.toFixed(2) || 'N/A'} GB
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Livre (média):</dt>
                                        <dd className="text-sm text-gray-900">
                                            {stats.hardware_averages.disk.avg_free_gb?.toFixed(2) || 'N/A'} GB
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Uso médio:</dt>
                                        <dd className="text-sm text-gray-900 font-medium">
                                            {stats.hardware_averages.disk.avg_usage_percent?.toFixed(1) || 'N/A'}%
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        )}
                    </div>
                    {stats.hardware_averages.computers_with_hardware_info && (
                        <p className="text-xs text-gray-500 mt-4">
                            Baseado em {stats.hardware_averages.computers_with_hardware_info} computador(es) com informações de hardware
                        </p>
                    )}
                </div>
            )}

            {/* OS Distribution */}
            {stats.os_distribution && stats.os_distribution.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Distribuição de Sistemas Operacionais</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.os_distribution.map((os, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-gray-900">{os.system}</h3>
                                    <Server className="h-4 w-4 text-gray-500" />
                                </div>
                                <p className="text-xs text-gray-500 mb-2">Versão: {os.release}</p>
                                <p className="text-sm font-medium text-blue-600">{os.count} computador(es)</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Computers List */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Monitor className="h-5 w-5 text-gray-700" />
                    <h2 className="text-lg font-semibold">
                        Computadores {computerPagination && `(${computerPagination.total})`}
                    </h2>
                </div>

                {/* Search and Filters */}
                <div className="flex gap-4 items-center mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            placeholder="Buscar por hostname ou ID..."
                            className="pl-10"
                            value={computerSearch}
                            onChange={(e) => handleComputerSearchChange(e.target.value)}
                        />
                    </div>
                    <Select value={computerStatusFilter} onValueChange={setComputerStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                        <Select value={computerPerPage.toString()} onValueChange={handleComputerPerPageChange}>
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

                {loadingComputers ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="text-gray-500">Carregando computadores...</div>
                    </div>
                ) : computers.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Hostname
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ID da Máquina
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Última Atualização
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {computers.map((computer) => (
                                        <tr key={computer.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {computer.hostname || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                {computer.machine_id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2.5 w-2.5 rounded-full ${isOnline(computer.updated_at) ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                    <span className="text-xs text-muted-foreground">
                                                        {isOnline(computer.updated_at) ? 'Online' : 'Offline'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(computer.updated_at).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => navigate(`/admin/computers/${computer.id}`)}
                                                >
                                                    Ver Detalhes
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {computerPagination && computerPagination.last_page > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Mostrando {computerPagination.from} a {computerPagination.to} de {computerPagination.total} computadores
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setComputerCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={computerCurrentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Anterior
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, computerPagination.last_page) }, (_, i) => {
                                            let pageNum;
                                            if (computerPagination.last_page <= 5) {
                                                pageNum = i + 1;
                                            } else if (computerCurrentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (computerCurrentPage >= computerPagination.last_page - 2) {
                                                pageNum = computerPagination.last_page - 4 + i;
                                            } else {
                                                pageNum = computerCurrentPage - 2 + i;
                                            }
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={computerCurrentPage === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setComputerCurrentPage(pageNum)}
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
                                        onClick={() => setComputerCurrentPage(prev => Math.min(computerPagination.last_page, prev + 1))}
                                        disabled={computerCurrentPage === computerPagination.last_page}
                                    >
                                        Próxima
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-8">
                        {computerSearch || computerStatusFilter !== 'all' 
                            ? 'Nenhum computador encontrado com os filtros selecionados' 
                            : 'Nenhum computador registrado neste laboratório'}
                    </p>
                )}
            </div>

            {/* Softwares List */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-gray-700" />
                    <h2 className="text-lg font-semibold">
                        Softwares Instalados {softwarePagination && `(${softwarePagination.total})`}
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

                                    {software.computers_count !== undefined && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <span className="text-xs text-gray-500">Instalado em: </span>
                                            <span className="text-sm font-medium text-blue-600">
                                                {software.computers_count} computador(es)
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
                    </>
                ) : (
                    <div className="text-center py-12">
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                            {softwareSearch ? 'Nenhum software encontrado com sua busca' : 'Nenhum software instalado neste laboratório'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
