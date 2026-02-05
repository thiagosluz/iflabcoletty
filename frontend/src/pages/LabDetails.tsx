import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import { isComputerOnline } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import {
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
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
    RefreshCw,
    RotateCw,
    MessageSquare,
    Zap,
    Terminal,
    Map as MapIcon,
    List,
    Download,
    Image as ImageIcon,
    Trash2,
    ExternalLink,
    Pencil,
    PowerOff,
    FileText
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import LabMap from '@/components/LabMap';
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
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from '@/components/ui/checkbox';
import SoftwareComputersModal from '@/components/SoftwareComputersModal';
import { FileTransferDialog } from '@/components/modals/FileTransferDialog';

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
    default_wallpaper_url?: string | null;
    default_wallpaper_enabled?: boolean;
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

type LabDetailsComputerSortBy = 'hostname' | 'machine_id' | 'status' | 'updated_at';
type SortDir = 'asc' | 'desc';

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
    const [computerSortBy, setComputerSortBy] = useState<LabDetailsComputerSortBy>('hostname');
    const [computerSortDir, setComputerSortDir] = useState<SortDir>('asc');
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
    const [isTerminalDialogOpen, setIsTerminalDialogOpen] = useState(false);
    const [terminalCommand, setTerminalCommand] = useState('');
    const [confirmAction, setConfirmAction] = useState<{ command: string, title: string, description: string } | null>(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportVariant, setExportVariant] = useState<'complete' | 'summary'>('complete');
    const [exportAsync, setExportAsync] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isWallpaperDialogOpen, setIsWallpaperDialogOpen] = useState(false);
    const [wallpaperEditUrl, setWallpaperEditUrl] = useState('');
    const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
    const [isFileTransferOpen, setIsFileTransferOpen] = useState(false);
    const [softwareComputersModal, setSoftwareComputersModal] = useState<{ id: number; name: string } | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (id) fetchLabDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run when id changes only
    }, [id]);

    useEffect(() => {
        if (id) fetchComputers();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination/filters drive refetch
    }, [id, computerCurrentPage, computerPerPage, computerSearch, computerStatusFilter, computerSortBy, computerSortDir]);

    useEffect(() => {
        if (id) fetchSoftwares();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination/search drive refetch
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
            params.append('sort_by', computerSortBy);
            params.append('sort_dir', computerSortDir);

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

    const handleMapUpdate = async () => {
        // Fetch all computers for the map (without pagination/filters)
        if (!id) return [];

        try {
            const response = await apiClient.get(`/labs/${id}/computers?per_page=1000`);
            const allComputers = response.data.data || [];

            // Also update the main computers state if we're on page 1 and no filters
            if (computerCurrentPage === 1 && !computerSearch && computerStatusFilter === 'all') {
                setComputers(allComputers);
            }

            // Recalculate stats
            await fetchLabDetails();

            return allComputers;
        } catch (error) {
            console.error('Falha ao atualizar dados do mapa:', error);
            return [];
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

    const handleLabCommand = async (command: string, params: Record<string, unknown> = {}) => {
        if (!id) return;
        try {
            await apiClient.post(`/labs/${id}/commands`, { command, parameters: params });
            if (command === 'wol') {
                toast({
                    title: 'WoL na fila',
                    description: 'Para cada PC desligado, outro computador do mesmo laboratório enviará o pacote quando o agente dele verificar a fila.',
                });
            } else {
                toast({
                    title: 'Comando na fila',
                    description: 'O agente executará quando estiver online nos computadores do laboratório.',
                });
            }
            setIsLabMessageOpen(false);
            setLabMessageText('');
            setConfirmAction(null);
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleComputerSearchChange = (value: string) => {
        setComputerSearch(value);
        setComputerCurrentPage(1);
    };

    const handleComputerSort = (column: LabDetailsComputerSortBy) => {
        if (computerSortBy === column) {
            setComputerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setComputerSortBy(column);
            setComputerSortDir('asc');
        }
        setComputerCurrentPage(1);
    };

    const handleComputerPerPageChange = (value: string) => {
        setComputerPerPage(parseInt(value));
        setComputerCurrentPage(1);
    };

    const handleExportLabDetails = async () => {
        if (!id) return;
        try {
            setIsExporting(true);
            const response = await apiClient.post(
                '/reports/lab-details',
                { lab_id: parseInt(id), format: 'pdf', variant: exportVariant, async: exportAsync },
                exportAsync ? { responseType: 'json' } : { responseType: 'blob' }
            );
            if (exportAsync && response.status === 202) {
                toast({ title: 'Relatório em processamento', description: 'Você será redirecionado para acompanhar o status.' });
                setIsExportOpen(false);
                setTimeout(() => navigate('/admin/report-jobs'), 500);
            } else if (!exportAsync && response.data instanceof Blob) {
                const url = window.URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                link.download = `lab-detalhes-${id}-${exportVariant}-${new Date().toISOString().slice(0, 10)}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast({ title: 'Exportação concluída', description: 'Relatório exportado em PDF.' });
                setIsExportOpen(false);
            }
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsExporting(false);
        }
    };

    const handleWallpaperExcluir = async () => {
        if (!id || !lab) return;
        try {
            await apiClient.put(`/labs/${id}`, { ...lab, default_wallpaper_url: '' });
            toast({ title: 'Papel de parede removido', description: 'O papel de parede padrão foi excluído.' });
            fetchLabDetails();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleWallpaperToggleEnabled = async () => {
        if (!id || !lab) return;
        const next = !(lab.default_wallpaper_enabled ?? true);
        try {
            await apiClient.put(`/labs/${id}`, { default_wallpaper_enabled: next });
            toast({ title: next ? 'Ativado' : 'Desativado', description: next ? 'O agente voltará a aplicar o papel de parede nos computadores.' : 'O agente deixará de aplicar o papel de parede.' });
            fetchLabDetails();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleWallpaperSave = async (url: string) => {
        if (!id) return;
        try {
            await apiClient.put(`/labs/${id}`, { default_wallpaper_url: url || '' });
            toast({ title: 'Salvo', description: url ? 'Papel de parede atualizado.' : 'Papel de parede removido.' });
            setIsWallpaperDialogOpen(false);
            setWallpaperEditUrl('');
            fetchLabDetails();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleWallpaperUpload = async (file: File) => {
        if (!id) return;
        try {
            setUploadingWallpaper(true);
            const formData = new FormData();
            formData.append('wallpaper', file);
            const res = await apiClient.post(`/labs/${id}/wallpaper`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setWallpaperEditUrl(res.data.default_wallpaper_url);
            toast({ title: 'Imagem enviada', description: 'Salve para confirmar ou altere a URL.' });
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setUploadingWallpaper(false);
        }
    };

    const resolveWallpaperUrl = (url: string | null | undefined): string => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return window.location.origin + (url.startsWith('/') ? url : '/' + url);
    };

    const handleSoftwareSearchChange = (value: string) => {
        setSoftwareSearch(value);
        setSoftwareCurrentPage(1);
    };

    const handleSoftwarePerPageChange = (value: string) => {
        setSoftwarePerPage(parseInt(value));
        setSoftwareCurrentPage(1);
    };

    // Use shared utility function for consistency
    const isOnline = (updatedAt: string) => {
        return isComputerOnline(updatedAt, 5);
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

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsExportOpen(true)}>
                        <Download className="mr-2 h-4 w-4" /> Exportar relatório
                    </Button>
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
                            <DropdownMenuItem onClick={() => setConfirmAction({ command: 'update_agent', title: 'Atualizar agente em massa', description: 'O comando será enfileirado para todos os computadores deste laboratório. Os agentes online executarão a atualização ao verificar a fila.' })}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar agente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLabCommand('wol')}>
                                <Zap className="mr-2 h-4 w-4" /> Acordar Todos (WoL)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsLabMessageOpen(true)}>
                                <MessageSquare className="mr-2 h-4 w-4" /> Enviar Mensagem
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsTerminalDialogOpen(true)} className="text-yellow-600 focus:text-yellow-700">
                                <Terminal className="mr-2 h-4 w-4" /> Terminal em Massa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsFileTransferOpen(true)}>
                                <FileText className="mr-2 h-4 w-4" /> Enviar Arquivo
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Export Report Dialog */}
                    <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Exportar relatório do laboratório</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Tipo de relatório</Label>
                                    <Select value={exportVariant} onValueChange={(v: 'complete' | 'summary') => setExportVariant(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="complete">Relatório completo</SelectItem>
                                            <SelectItem value="summary">Relatório resumido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {exportVariant === 'complete' ? 'Inclui todas as informações: resumo, médias, distribuição OS, lista de computadores, softwares e posições no mapa.' : 'Informações condensadas: totais, médias resumidas e distribuição de SO.'}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="export-async" checked={exportAsync} onCheckedChange={(c) => setExportAsync(c === true)} />
                                    <Label htmlFor="export-async" className="text-sm font-normal cursor-pointer">Processar em background (recomendado)</Label>
                                </div>
                                {exportAsync && (
                                    <p className="text-xs text-muted-foreground">Você será redirecionado para acompanhar o status do processamento.</p>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsExportOpen(false)} disabled={isExporting}>Cancelar</Button>
                                <Button onClick={handleExportLabDetails} disabled={isExporting}>
                                    {isExporting ? <> <span className="animate-spin mr-2">⏳</span> {exportAsync ? 'Enviando...' : 'Exportando...'} </> : <> <Download className="mr-2 h-4 w-4" /> Exportar </>}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

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
                                <Button onClick={() => handleLabCommand('message', { message: labMessageText ?? '' })}>Enviar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Terminal Dialog */}
                    <Dialog open={isTerminalDialogOpen} onOpenChange={setIsTerminalDialogOpen}>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Terminal className="h-5 w-5 text-yellow-600" />
                                    Terminal em Massa - {lab.name}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-md text-sm">
                                    <strong>Atenção:</strong> Este comando será executado em <strong>TODOS</strong> os computadores online deste laboratório com privilégios de sistema. Use com extremo cuidado.
                                </div>
                                <div>
                                    <Label htmlFor="terminal-cmd" className="mb-2 block">Comando (Shell)</Label>
                                    <div className="flex items-center bg-black rounded-md p-2 border border-gray-700">
                                        <span className="text-green-500 mr-2 font-mono select-none">$</span>
                                        <input
                                            id="terminal-cmd"
                                            value={terminalCommand}
                                            onChange={(e) => setTerminalCommand(e.target.value)}
                                            placeholder="Ex: ipconfig /flushdns"
                                            className="flex-1 bg-transparent text-gray-200 focus:outline-none font-mono text-sm"
                                            autoComplete="off"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Digite o comando compatível com o sistema operacional dos computadores alvo.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsTerminalDialogOpen(false)}>Cancelar</Button>
                                <Button
                                    onClick={() => {
                                        handleLabCommand('terminal', { cmd_line: terminalCommand });
                                        setIsTerminalDialogOpen(false);
                                        setTerminalCommand('');
                                    }}
                                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                                    disabled={!terminalCommand.trim()}
                                >
                                    Executar em Massa
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="details" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="details">
                        <List className="h-4 w-4 mr-2" />
                        Lista & Detalhes
                    </TabsTrigger>
                    <TabsTrigger value="map">
                        <MapIcon className="h-4 w-4 mr-2" />
                        Mapa Visual
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6">
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

                    {/* Papel de parede padrão */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ImageIcon className="h-5 w-5 text-gray-700" />
                            <h2 className="text-lg font-semibold">Papel de parede padrão</h2>
                        </div>
                        {lab.default_wallpaper_url ? (
                            <div className="flex flex-col sm:flex-row gap-4 items-start">
                                <div className="flex-shrink-0">
                                    <a href={resolveWallpaperUrl(lab.default_wallpaper_url)} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 max-w-[280px] max-h-[160px] bg-gray-100">
                                        <img src={resolveWallpaperUrl(lab.default_wallpaper_url)} alt="Papel de parede" className="w-full h-full object-cover aspect-video" />
                                    </a>
                                    <p className="text-xs text-muted-foreground mt-1">Clique na imagem para abrir em tamanho real</p>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lab.default_wallpaper_enabled !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {lab.default_wallpaper_enabled !== false ? 'Utilizando' : 'Desativado'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 break-all">{resolveWallpaperUrl(lab.default_wallpaper_url)}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" asChild>
                                            <a href={resolveWallpaperUrl(lab.default_wallpaper_url)} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4 mr-2" /> Visualizar
                                            </a>
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => { setWallpaperEditUrl(lab.default_wallpaper_url || ''); setIsWallpaperDialogOpen(true); }}>
                                            <Pencil className="h-4 w-4 mr-2" /> Alterar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleWallpaperToggleEnabled}>
                                            {lab.default_wallpaper_enabled !== false ? <PowerOff className="h-4 w-4 mr-2" /> : <Power className="h-4 w-4 mr-2" />}
                                            {lab.default_wallpaper_enabled !== false ? 'Desativar uso' : 'Ativar uso'}
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir papel de parede?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        O papel de parede padrão será removido do laboratório. Os agentes deixarão de aplicar esta imagem nos computadores.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleWallpaperExcluir} className="bg-red-600 hover:bg-red-700">
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <p className="text-gray-500">Nenhum papel de parede definido. Os computadores do laboratório manterão o papel de parede atual.</p>
                                <Button variant="outline" onClick={() => { setWallpaperEditUrl(''); setIsWallpaperDialogOpen(true); }}>
                                    <ImageIcon className="h-4 w-4 mr-2" /> Definir papel de parede
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Dialog Alterar/Definir papel de parede */}
                    <Dialog open={isWallpaperDialogOpen} onOpenChange={(open) => { setIsWallpaperDialogOpen(open); if (!open) setWallpaperEditUrl(''); }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{lab?.default_wallpaper_url ? 'Alterar papel de parede' : 'Definir papel de parede padrão'}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>URL da imagem</Label>
                                    <Input
                                        value={wallpaperEditUrl}
                                        onChange={(e) => setWallpaperEditUrl(e.target.value)}
                                        placeholder="https://exemplo.com/imagem.jpg"
                                    />
                                </div>
                                {id && (
                                    <div className="space-y-2">
                                        <Label>Ou envie uma imagem</Label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="wallpaper-upload-detail"
                                                type="file"
                                                accept="image/jpeg,image/png,image/gif,image/webp"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleWallpaperUpload(file);
                                                    e.target.value = '';
                                                }}
                                            />
                                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('wallpaper-upload-detail')?.click()} disabled={uploadingWallpaper}>
                                                {uploadingWallpaper ? 'Enviando...' : 'Selecionar arquivo'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsWallpaperDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={() => handleWallpaperSave(wallpaperEditUrl.trim())}>Salvar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

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
                                                    <Button variant="ghost" className="-ml-2 h-8 font-semibold text-gray-500" onClick={() => handleComputerSort('hostname')}>
                                                        Hostname
                                                        {computerSortBy === 'hostname' && (computerSortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                                    </Button>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <Button variant="ghost" className="-ml-2 h-8 font-semibold text-gray-500" onClick={() => handleComputerSort('machine_id')}>
                                                        ID da Máquina
                                                        {computerSortBy === 'machine_id' && (computerSortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                                    </Button>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <Button variant="ghost" className="-ml-2 h-8 font-semibold text-gray-500" onClick={() => handleComputerSort('status')}>
                                                        Status
                                                        {computerSortBy === 'status' && (computerSortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                                    </Button>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <Button variant="ghost" className="-ml-2 h-8 font-semibold text-gray-500" onClick={() => handleComputerSort('updated_at')}>
                                                        Última Atualização
                                                        {computerSortBy === 'updated_at' && (computerSortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                                    </Button>
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
                                                    <Button
                                                        variant="link"
                                                        className="h-auto p-0 text-sm font-medium text-blue-600"
                                                        onClick={() => setSoftwareComputersModal({ id: software.id, name: software.name })}
                                                    >
                                                        {software.computers_count} computador(es) — Ver computadores
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {softwarePagination && softwarePagination.last_page > 1 && (
                                        <div className="mt-4 flex items-center justify-between col-span-full">
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
                                </div>
                            </>
                        ) : (
                            <p className="text-gray-500 text-sm text-center py-8">
                                {softwareSearch
                                    ? 'Nenhum software encontrado com o filtro selecionado'
                                    : 'Nenhum software instalado registrado'}
                            </p>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="map">
                    {lab && (
                        <LabMap
                            labId={lab.id.toString()}
                            computers={computers}
                            onUpdate={handleMapUpdate}
                        />
                    )}
                </TabsContent>
            </Tabs>

            <SoftwareComputersModal
                open={softwareComputersModal !== null}
                onOpenChange={(open) => !open && setSoftwareComputersModal(null)}
                softwareId={softwareComputersModal?.id ?? null}
                softwareName={softwareComputersModal?.name ?? ''}
                labId={id ? parseInt(id, 10) : undefined}
            />

            <FileTransferDialog
                open={isFileTransferOpen}
                onOpenChange={setIsFileTransferOpen}
                targets={{ labs: id ? [parseInt(id, 10)] : [] }}
            />
        </div>
    );
}
