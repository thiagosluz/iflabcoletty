import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '@/lib/axios';
import { isComputerOnline } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import { MoreHorizontal, Plus, Search, QrCode, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, Trash2, List, LayoutGrid } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import ExportDialog from '@/components/ExportDialog';
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
} from '@/components/ui/alert-dialog';

interface Lab {
    id: number;
    name: string;
}

interface Computer {
    id: number;
    machine_id: string;
    public_hash: string;
    hostname: string;
    lab?: Lab;
    created_at: string;
    updated_at: string;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

// Use shared utility function for consistency
const isOnline = (dateString: string) => isComputerOnline(dateString, 5);

type ComputerSortBy = 'hostname' | 'machine_id' | 'lab' | 'status' | 'updated_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'online' | 'offline';

const computerSchema = z.object({
    lab_id: z.string().min(1, "Laboratório é obrigatório"),
    hostname: z.string().optional(),
    machine_id: z.string().min(1, "ID da Máquina é obrigatório"),
});

type ComputerFormData = z.infer<typeof computerSchema>;

export default function Computers() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const statusFilter: StatusFilter = (() => {
        const s = searchParams.get('status');
        if (s === 'online' || s === 'offline') return s;
        return 'all';
    })();
    const outdatedFilter = searchParams.get('outdated') === '1' || searchParams.get('outdated') === 'true';

    const [computers, setComputers] = useState<Computer[]>([]);
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [labFilter, setLabFilter] = useState<string>('all');
    const [exportLabId, setExportLabId] = useState<string>('all');
    const [exportFormat, setExportFormat] = useState<'pdf' | 'zip'>('pdf');
    const [isExporting, setIsExporting] = useState(false);
    const [exportComputerCount, setExportComputerCount] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [computerToDelete, setComputerToDelete] = useState<Computer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [sortBy, setSortBy] = useState<ComputerSortBy>('hostname');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const { toast } = useToast();

    const handleSort = (column: ComputerSortBy) => {
        if (sortBy === column) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(column);
            setSortDir('asc');
        }
        setCurrentPage(1);
    };

    const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ComputerFormData>({
        resolver: zodResolver(computerSchema),
    });

    const fetchLabs = async () => {
        try {
            // Fetch all labs for the filter dropdown (no pagination needed here)
            const { data } = await apiClient.get('/labs?per_page=1000');
            setLabs(data.data || data || []);
        } catch (e) { }
    };

    const fetchComputers = async () => {
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());
            if (search) params.append('search', search);
            if (labFilter !== 'all') params.append('lab_id', labFilter);
            if (statusFilter === 'online') params.append('status', 'online');
            if (statusFilter === 'offline') params.append('status', 'offline');
            if (outdatedFilter) params.append('outdated', '1');
            params.append('sort_by', sortBy);
            params.append('sort_dir', sortDir);

            const { data } = await apiClient.get(`/computers?${params.toString()}`);
            setComputers(data.data || []);
            setPagination({
                current_page: data.current_page || 1,
                last_page: data.last_page || 1,
                per_page: data.per_page || perPage,
                total: data.total || 0,
                from: data.from || 0,
                to: data.to || 0,
            });
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchLabs();
    }, []);

    useEffect(() => {
        fetchComputers();
    }, [search, labFilter, statusFilter, outdatedFilter, currentPage, perPage, sortBy, sortDir]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setCurrentPage(1); // Reset to first page on search
    };

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing per page
    };

    const handleStatusFilterChange = (value: StatusFilter) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (value === 'all') p.delete('status');
            else p.set('status', value);
            p.delete('page');
            return p;
        });
        setCurrentPage(1);
    };

    const handleOutdatedFilterChange = (checked: boolean) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (checked) p.set('outdated', '1');
            else p.delete('outdated');
            p.delete('page');
            return p;
        });
        setCurrentPage(1);
    };

    const onSubmit = async (data: ComputerFormData) => {
        try {
            await apiClient.post('/computers', data);
            toast({ title: 'Sucesso', description: 'Computador criado com sucesso' });
            setIsOpen(false);
            reset();
            fetchComputers(); // Refresh to show new computer immediately
        } catch (error: any) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleDelete = async () => {
        if (!computerToDelete) return;
        
        try {
            setIsDeleting(true);
            await apiClient.delete(`/computers/${computerToDelete.id}`);
            toast({ title: 'Excluído', description: 'Computador excluído com sucesso' });
            
            // Force refresh by bypassing cache and adjusting page if needed
            const currentComputersCount = computers.length;
            
            // If we're on the last page and it only has one item, go to previous page
            if (pagination && currentComputersCount === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
                // fetchComputers will be called automatically by useEffect
            } else {
                // Refresh to ensure we get fresh data
                await fetchComputers();
            }
            
            setComputerToDelete(null);
        } catch (error) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const fetchExportComputerCount = async () => {
        try {
            const params = new URLSearchParams();
            params.append('per_page', '1000'); // Get all for counting
            if (exportLabId !== 'all') {
                params.append('lab_id', exportLabId);
            }
            const { data } = await apiClient.get(`/computers?${params.toString()}`);
            const computers = data.data || [];
            // Filter computers that have public_hash
            const computersWithHash = computers.filter((pc: Computer) => pc.public_hash);
            setExportComputerCount(computersWithHash.length);
        } catch (error) {
            setExportComputerCount(null);
        }
    };

    useEffect(() => {
        if (isExportOpen) {
            fetchExportComputerCount();
        } else {
            setExportComputerCount(null);
        }
    }, [isExportOpen, exportLabId]);

    const handleExportQRCodes = async () => {
        // Validate before export
        if (exportComputerCount === 0) {
            toast({
                title: 'Nenhum computador disponível',
                description: 'Não há computadores com public_hash para exportar. Verifique os filtros ou gere os hashes primeiro.',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsExporting(true);
            const payload: any = {
                format: exportFormat,
                base_url: typeof window !== 'undefined' ? window.location.origin : undefined,
            };
            if (exportLabId !== 'all') {
                payload.lab_id = parseInt(exportLabId);
            }

            const response = await apiClient.post('/computers/export-qrcodes', payload, {
                responseType: 'blob',
            });

            // Check if response is actually an error JSON (when backend returns error as JSON but we requested blob)
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
                // Response is JSON error, parse it
                const text = await response.data.text();
                const errorData = JSON.parse(text);
                throw new Error(errorData.message || 'Erro ao exportar QR codes');
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = exportFormat === 'pdf' ? 'pdf' : 'zip';
            link.setAttribute('download', `qrcodes-${new Date().toISOString().slice(0, 10)}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast({
                title: 'Exportação concluída!',
                description: `${exportComputerCount} QR code(s) exportado(s) em formato ${exportFormat.toUpperCase()}.`,
            });
            setIsExportOpen(false);
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportReport = async (format: 'pdf' | 'csv' | 'xlsx', async = true) => {
        try {
            const params: any = {
                format,
                async,
            };

            // Apply current filters
            if (search) {
                params.search = search;
            }
            if (labFilter && labFilter !== 'all') {
                params.lab_id = labFilter;
            }

            const response = await apiClient.post('/reports/computers', params, async ? {
                responseType: 'json',
            } : {
                responseType: 'blob',
            });

            // If async, return early (user will be redirected to jobs page)
            if (async && response.status === 202) {
                return; // Job created, user will be redirected
            }

            // Check if response is actually an error JSON
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const errorData = JSON.parse(text);
                throw new Error(errorData.message || 'Erro ao exportar computadores');
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = format;
            link.setAttribute('download', `computadores-${new Date().toISOString().slice(0, 10)}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            let errorMessage = 'Falha ao exportar computadores';
            
            if (error.response) {
                const contentType = error.response.headers?.['content-type'] || '';
                if (contentType.includes('application/json')) {
                    errorMessage = error.response.data?.message || errorMessage;
                } else if (error.response.data instanceof Blob) {
                    try {
                        const text = await error.response.data.text();
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        errorMessage = error.response.statusText || errorMessage;
                    }
                } else {
                    errorMessage = error.response.data?.message || error.response.statusText || errorMessage;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Computadores</h2>
                <div className="flex gap-2">
                    <ExportDialog
                        trigger={
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" /> Exportar Relatório
                            </Button>
                        }
                        onExport={handleExportReport}
                        title="Exportar Relatório de Computadores"
                        description="Escolha o formato para exportar a lista de computadores com os filtros aplicados"
                    />
                    <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <QrCode className="mr-2 h-4 w-4" /> Exportar QR Codes
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Exportar QR Codes</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {exportComputerCount !== null && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                        <p className="text-sm text-blue-900">
                                            <strong>{exportComputerCount}</strong> computador(es) será(ão) exportado(s)
                                        </p>
                                        {exportComputerCount === 0 && (
                                            <p className="text-xs text-blue-700 mt-1">
                                                Nenhum computador com public_hash encontrado. Gere os hashes primeiro.
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Laboratório</Label>
                                    <Select value={exportLabId} onValueChange={setExportLabId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um laboratório" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os Laboratórios</SelectItem>
                                            {labs.map(lab => (
                                                <SelectItem key={lab.id} value={String(lab.id)}>{lab.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Formato</Label>
                                    <Select value={exportFormat} onValueChange={(value: 'pdf' | 'zip') => setExportFormat(value)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pdf">PDF (Documento único)</SelectItem>
                                            <SelectItem value="zip">ZIP (Arquivos individuais)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setIsExportOpen(false)} disabled={isExporting}>
                                        Cancelar
                                    </Button>
                                    <Button onClick={handleExportQRCodes} disabled={isExporting || exportComputerCount === 0}>
                                        {isExporting ? (
                                            <>
                                                <span className="animate-spin mr-2">⏳</span>
                                                Exportando...
                                            </>
                                        ) : (
                                            'Exportar'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> Adicionar Computador</Button>
                        </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Computador Manualmente</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Laboratório</Label>
                                <Controller
                                    control={control}
                                    name="lab_id"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione um laboratório" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {labs.map(lab => (
                                                    <SelectItem key={lab.id} value={String(lab.id)}>{lab.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.lab_id && <p className="text-sm text-red-500">{errors.lab_id.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Hostname</Label>
                                <Input {...register('hostname')} placeholder="LAB01-PC01" />
                            </div>
                            <div className="space-y-2">
                                <Label>ID da Máquina (UUID)</Label>
                                <Input {...register('machine_id')} placeholder="ID Único de Hardware" />
                                {errors.machine_id && <p className="text-sm text-red-500">{errors.machine_id.message}</p>}
                            </div>
                            <Button type="submit" disabled={isSubmitting}>Criar</Button>
                        </form>
                    </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex gap-4 items-center flex-wrap">
                    <div className="relative w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por hostname ou ID..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                    <Select value={labFilter} onValueChange={setLabFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filtrar por Laboratório" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Laboratórios</SelectItem>
                            {labs.map(lab => (
                                <SelectItem key={lab.id} value={String(lab.id)}>{lab.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v) => handleStatusFilterChange(v as StatusFilter)}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="outdated-filter"
                            checked={outdatedFilter}
                            onCheckedChange={(checked) => handleOutdatedFilterChange(checked === true)}
                        />
                        <label htmlFor="outdated-filter" className="text-sm cursor-pointer whitespace-nowrap">
                            Agentes desatualizados
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                        <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
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
                    <div className="flex items-center gap-1">
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'outline'}
                            size="icon"
                            onClick={() => setViewMode('list')}
                            title="Lista"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'default' : 'outline'}
                            size="icon"
                            onClick={() => setViewMode('grid')}
                            title="Grid"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
            {viewMode === 'list' && (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('hostname')}>
                                        Hostname
                                        {sortBy === 'hostname' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('machine_id')}>
                                        ID da Máquina
                                        {sortBy === 'machine_id' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('lab')}>
                                        Laboratório
                                        {sortBy === 'lab' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('status')}>
                                        Status
                                        {sortBy === 'status' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('updated_at')}>
                                        Última Atualização
                                        {sortBy === 'updated_at' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {computers.map((pc) => (
                                <TableRow key={pc.id}>
                                    <TableCell className="font-medium">{pc.hostname || '-'}</TableCell>
                                    <TableCell className="font-mono text-xs">{pc.machine_id}</TableCell>
                                    <TableCell>{pc.lab?.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className={`h-2.5 w-2.5 rounded-full ${isOnline(pc.updated_at) ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            <span className="text-xs text-muted-foreground">
                                                {isOnline(pc.updated_at) ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(pc.updated_at).toLocaleString('pt-BR')}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => navigate(`/admin/computers/${pc.id}`)}>
                                                    Ver Detalhes
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => setComputerToDelete(pc)} 
                                                    className="text-red-600"
                                                >
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {computers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Nenhum computador encontrado.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {viewMode === 'grid' && (
                <>
                    {computers.length === 0 ? (
                        <div className="border rounded-md flex items-center justify-center h-24 text-muted-foreground">
                            Nenhum computador encontrado.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {computers.map((pc) => (
                                <div
                                    key={pc.id}
                                    className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow flex flex-col gap-3"
                                >
                                    <div className="font-semibold text-base truncate" title={pc.hostname || pc.machine_id}>
                                        {pc.hostname || pc.machine_id || '-'}
                                    </div>
                                    {pc.lab?.name && (
                                        <div className="text-sm text-muted-foreground truncate" title={pc.lab.name}>
                                            {pc.lab.name}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isOnline(pc.updated_at) ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <span className="text-xs text-muted-foreground">
                                            {isOnline(pc.updated_at) ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(pc.updated_at).toLocaleString('pt-BR')}
                                    </div>
                                    <div className="flex gap-2 mt-auto pt-2 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => navigate(`/admin/computers/${pc.id}`)}
                                        >
                                            Ver Detalhes
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => setComputerToDelete(pc)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

                {/* Pagination */}
                {pagination && pagination.last_page > 1 && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                            Mostrando {pagination.from} a {pagination.to} de {pagination.total} computadores
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                                    let pageNum;
                                    if (pagination.last_page <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= pagination.last_page - 2) {
                                        pageNum = pagination.last_page - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNum)}
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
                                onClick={() => setCurrentPage(prev => Math.min(pagination.last_page, prev + 1))}
                                disabled={currentPage === pagination.last_page}
                            >
                                Próxima
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Info when no pagination needed */}
                {pagination && pagination.last_page === 1 && (
                    <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                        Mostrando {pagination.total} {pagination.total === 1 ? 'computador' : 'computadores'}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={computerToDelete !== null} onOpenChange={(open) => !open && setComputerToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o computador <strong>{computerToDelete?.hostname || computerToDelete?.machine_id}</strong>?
                            <br />
                            <span className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {isDeleting ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    Excluindo...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
