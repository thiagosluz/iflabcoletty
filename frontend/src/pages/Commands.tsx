import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import apiClient from '@/lib/axios';
import { getApiErrorToast } from '@/lib/apiError';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Search, Trash2, Server, LogOut, Power, RefreshCw, MessageSquare, Monitor, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ComputerCommand {
    id: number;
    computer: {
        id: number;
        hostname: string;
    };
    user: {
        id: number;
        name: string;
    };
    command: string;
    parameters: any;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    output: string | null;
    executed_at: string | null;
    expires_at: string | null;
    created_at: string;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

const commandLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    shutdown: { label: 'Desligar', icon: <Power className="w-4 h-4" /> },
    restart: { label: 'Reiniciar', icon: <RefreshCw className="w-4 h-4" /> },
    lock: { label: 'Bloquear', icon: <Monitor className="w-4 h-4" /> },
    logoff: { label: 'Fazer Logoff', icon: <LogOut className="w-4 h-4" /> },
    message: { label: 'Mensagem', icon: <MessageSquare className="w-4 h-4" /> },
    wol: { label: 'Ligar (WOL)', icon: <Power className="w-4 h-4 text-green-500" /> },
    screenshot: { label: 'Capturar Tela', icon: <Monitor className="w-4 h-4" /> },
    terminal: { label: 'Terminal', icon: <Server className="w-4 h-4" /> },
    ps_list: { label: 'Listar Processos', icon: <FileText className="w-4 h-4" /> },
    ps_kill: { label: 'Encerrar Processo', icon: <XCircle className="w-4 h-4 text-red-500" /> },
    install_software: { label: 'Instalar Software', icon: <FileText className="w-4 h-4" /> },
    update_agent: { label: 'Atualizar Agente', icon: <RefreshCw className="w-4 h-4 text-blue-500" /> },
    set_hostname: { label: 'Definir Hostname', icon: <Monitor className="w-4 h-4 text-orange-500" /> },
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    processing: 'Em Execução',
    completed: 'Concluído',
    failed: 'Falha',
};

const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 mr-1" />,
    processing: <RefreshCw className="w-4 h-4 mr-1 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 mr-1" />,
    failed: <XCircle className="w-4 h-4 mr-1" />,
};

export default function Commands() {
    const { toast } = useToast();
    const [commands, setCommands] = useState<ComputerCommand[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);

    // Selection and Bulk Actions
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [singleDeleteId, setSingleDeleteId] = useState<number | null>(null);

    const fetchCommands = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());
            if (searchTerm) params.append('search', searchTerm);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            const response = await apiClient.get(`/commands?${params.toString()}`);
            setCommands(response.data.data || []);
            setPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || perPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
            setSelectedIds([]); // Reset selection on new fetch
        } catch (error: unknown) {
            console.error('Falha ao buscar comandos:', error);
            toast({ ...getApiErrorToast(error) });
        } finally {
            setLoading(false);
        }
    }, [currentPage, perPage, searchTerm, statusFilter, toast]);

    useEffect(() => {
        fetchCommands();
    }, [fetchCommands]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        setCurrentPage(1);
    };

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        setCurrentPage(1);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(commands.map((c) => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedIds((prev) => [...prev, id]);
        } else {
            setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            if (singleDeleteId) {
                await apiClient.delete(`/commands/${singleDeleteId}`);
                toast({ title: 'Excluído', description: 'Comando excluído com sucesso.' });
            } else if (selectedIds.length > 0) {
                await apiClient.post('/commands/bulk-delete', { command_ids: selectedIds });
                toast({ title: 'Excluídos', description: `${selectedIds.length} comandos excluídos com sucesso.` });
            }
            fetchCommands();
        } catch (error: unknown) {
            console.error('Falha ao excluir comandos:', error);
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
            setSingleDeleteId(null);
        }
    };

    const confirmDelete = (id?: number) => {
        if (id) {
            setSingleDeleteId(id);
        } else {
            setSingleDeleteId(null); // Indicates it's a bulk delete
        }
        setShowDeleteConfirm(true);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Comandos Remotos</h1>
                <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                        <Button
                            variant="destructive"
                            onClick={() => confirmDelete()}
                            size="sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir Selecionados ({selectedIds.length})
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchCommands} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex items-center w-full sm:w-auto relative">
                    <Search className="h-4 w-4 absolute left-3 text-gray-400" />
                    <Input
                        placeholder="Buscar por computador..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="pl-9 w-full sm:w-[300px]"
                    />
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Status</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="processing">Em Execução</SelectItem>
                            <SelectItem value="completed">Concluída</SelectItem>
                            <SelectItem value="failed">Falha</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-white rounded-md border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 text-center">
                                <Checkbox
                                    checked={commands.length > 0 && selectedIds.length === commands.length}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Computador</TableHead>
                            <TableHead>Comando</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Duração/Expiração</TableHead>
                            <TableHead>Resultado</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && commands.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                                    Carregando comandos...
                                </TableCell>
                            </TableRow>
                        ) : commands.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-lg">
                                    Nenhum comando encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            commands.map((cmd) => {
                                const info = commandLabels[cmd.command] || { label: cmd.command, icon: <Server className="w-4 h-4" /> };

                                return (
                                    <TableRow key={cmd.id}>
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={selectedIds.includes(cmd.id)}
                                                onCheckedChange={(checked) => handleSelectRow(cmd.id, checked as boolean)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {cmd.computer?.hostname || `PC Desconhecido (#${cmd.computer.id})`}
                                            <div className="text-xs text-gray-500 font-normal">
                                                Enviado por: {cmd.user?.name || 'Sistema'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {info.icon}
                                                <span>{info.label}</span>
                                            </div>
                                            {cmd.command === 'terminal' && cmd.parameters?.cmd_line && (
                                                <div className="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={cmd.parameters.cmd_line}>
                                                    <code>{cmd.parameters.cmd_line}</code>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`flex items-center w-fit ${statusColors[cmd.status] || ''}`} variant="outline">
                                                {statusIcons[cmd.status]} {statusLabels[cmd.status] || cmd.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                                                <span className="text-gray-500 text-right">Criado:</span>
                                                <span className="font-mono">{formatDate(cmd.created_at)}</span>

                                                {cmd.status === 'pending' ? (
                                                    <>
                                                        <span className="text-gray-500 text-right">Expira:</span>
                                                        <span className="font-mono text-orange-600">{formatDate(cmd.expires_at)}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-gray-500 text-right">Executado:</span>
                                                        <span className="font-mono">{formatDate(cmd.executed_at)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs text-gray-700 max-h-16 overflow-y-auto max-w-xs break-words" title={cmd.output || ''}>
                                                {cmd.output ? cmd.output : <span className="text-gray-400 italic">Sem saída / Pendente</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => confirmDelete(cmd.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {pagination && pagination.last_page > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                        <div className="flex items-center text-sm text-gray-500">
                            Mostrando {pagination.from || 0} até {pagination.to || 0} de {pagination.total} comandos
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={perPage.toString()} onValueChange={(val) => { setPerPage(parseInt(val)); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[80px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[10, 20, 50, 100].map(v => (
                                        <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || loading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="text-sm font-medium">
                                Página {currentPage} de {pagination.last_page}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(pagination.last_page, p + 1))}
                                disabled={currentPage === pagination.last_page || loading}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir {singleDeleteId ? 'Comando' : `${selectedIds.length} Comandos`}</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação irá apagar o{singleDeleteId ? '' : 's'} comando{singleDeleteId ? '' : 's'} selecionado{singleDeleteId ? '' : 's'} do histórico de forma permanente.
                            Tem certeza que deseja continuar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
