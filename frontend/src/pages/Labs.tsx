import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import { MoreHorizontal, Plus, Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, Trash2, Pencil, List, LayoutGrid } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
} from '@/components/ui/alert-dialog';

interface Lab {
    id: number;
    name: string;
    description: string;
    default_wallpaper_url?: string | null;
    default_wallpaper_enabled?: boolean;
    computers_count?: number;
    updated_at?: string;
}

type LabSortBy = 'id' | 'name' | 'description' | 'computers_count' | 'updated_at';
type SortDir = 'asc' | 'desc';

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

const labSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    default_wallpaper_url: z.string().max(500).optional(),
    default_wallpaper_enabled: z.boolean().optional(),
});

type LabFormData = z.infer<typeof labSchema>;

export default function Labs() {
    const navigate = useNavigate();
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    const [sortBy, setSortBy] = useState<LabSortBy>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const { toast } = useToast();

    const handleSort = (column: LabSortBy) => {
        if (sortBy === column) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(column);
            setSortDir('asc');
        }
        setCurrentPage(1);
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setCurrentPage(1);
    };

    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<LabFormData>({
        resolver: zodResolver(labSchema),
    });
    const wallpaperEnabled = watch('default_wallpaper_enabled');
    const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
    const [wallpaperFileToUpload, setWallpaperFileToUpload] = useState<File | null>(null);

    const fetchLabs = async () => {
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());
            if (search) params.append('search', search);
            params.append('sort_by', sortBy);
            params.append('sort_dir', sortDir);

            const response = await apiClient.get(`/labs?${params.toString()}`);
            setLabs(response.data.data || []);
            setPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || perPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchLabs();
    }, [search, currentPage, perPage, sortBy, sortDir]);

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing per page
    };

    const onSubmit = async (data: LabFormData) => {
        try {
            if (editingLab) {
                const payload = {
                    ...data,
                    default_wallpaper_enabled: data.default_wallpaper_enabled === true,
                };
                await apiClient.put(`/labs/${editingLab.id}`, payload);
                toast({ title: 'Sucesso', description: 'Laboratório atualizado com sucesso' });
            } else {
                const res = await apiClient.post('/labs', data);
                const newLab = res.data;
                if (wallpaperFileToUpload && newLab?.id) {
                    try {
                        setUploadingWallpaper(true);
                        const formData = new FormData();
                        formData.append('wallpaper', wallpaperFileToUpload);
                        await apiClient.post(`/labs/${newLab.id}/wallpaper`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                        toast({ title: 'Sucesso', description: 'Laboratório criado e papel de parede enviado.' });
                    } catch (err: unknown) {
                        toast({ ...getApiErrorToast(err) });
                    } finally {
                        setUploadingWallpaper(false);
                        setWallpaperFileToUpload(null);
                    }
                } else {
                    toast({ title: 'Sucesso', description: 'Laboratório criado com sucesso' });
                }
            }
            setIsOpen(false);
            setEditingLab(null);
            reset();
            setWallpaperFileToUpload(null);
            fetchLabs();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleDelete = async () => {
        if (!labToDelete) return;
        
        try {
            setIsDeleting(true);
            await apiClient.delete(`/labs/${labToDelete.id}`);
            toast({ title: 'Excluído', description: 'Laboratório excluído com sucesso' });
            
            // Force refresh by adjusting page if needed
            const currentLabsCount = labs.length;
            
            // If we're on the last page and it only has one item, go to previous page
            if (pagination && currentLabsCount === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
                // fetchLabs will be called automatically by useEffect
            } else {
                // Refresh to ensure we get fresh data
                await fetchLabs();
            }
            
            setLabToDelete(null);
        } catch (error) {
            toast({ title: 'Erro', description: 'Falha ao excluir laboratório', variant: 'destructive' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExport = async (format: 'pdf' | 'csv' | 'xlsx', async = true) => {
        try {
            const response = await apiClient.post('/reports/labs', {
                format,
                async,
            }, async ? {
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
                throw new Error(errorData.message || 'Erro ao exportar laboratórios');
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = format;
            link.setAttribute('download', `laboratorios-${new Date().toISOString().slice(0, 10)}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            let errorMessage = 'Falha ao exportar laboratórios';
            
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
                <h2 className="text-3xl font-bold tracking-tight">Laboratórios</h2>
                <div className="flex gap-2">
                    <ExportDialog
                        trigger={
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" /> Exportar
                            </Button>
                        }
                        onExport={handleExport}
                        title="Exportar Laboratórios"
                        description="Escolha o formato para exportar a lista de laboratórios"
                    />
                    <Button onClick={() => { setEditingLab(null); reset(); setWallpaperFileToUpload(null); setIsOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Laboratório
                    </Button>
                    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setEditingLab(null); reset(); setWallpaperFileToUpload(null); } }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingLab ? 'Editar Laboratório' : 'Criar Novo Laboratório'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome</Label>
                                    <Input {...register('name')} placeholder="Laboratório Info 1" />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Descrição</Label>
                                    <Input {...register('description')} placeholder="Laboratório principal" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Papel de parede padrão (URL)</Label>
                                    <Input {...register('default_wallpaper_url')} placeholder="https://exemplo.com/imagem.jpg" />
                                    <p className="text-xs text-muted-foreground">O agente aplicará este papel de parede nos computadores do laboratório. Deixe vazio para não definir.</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <Label htmlFor="wallpaper-upload" className="text-sm cursor-pointer text-primary hover:underline">Ou envie uma imagem:</Label>
                                        {editingLab ? (
                                            <>
                                                <input
                                                    id="wallpaper-upload"
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file || !editingLab) return;
                                                        try {
                                                            setUploadingWallpaper(true);
                                                            const formData = new FormData();
                                                            formData.append('wallpaper', file);
                                                            const res = await apiClient.post(`/labs/${editingLab.id}/wallpaper`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                            setValue('default_wallpaper_url', res.data.default_wallpaper_url);
                                                            toast({ title: 'Sucesso', description: 'Imagem enviada. Salve o formulário para confirmar.' });
                                                        } catch (err: unknown) {
                                                            toast({ ...getApiErrorToast(err) });
                                                        } finally {
                                                            setUploadingWallpaper(false);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('wallpaper-upload')?.click()} disabled={uploadingWallpaper}>
                                                    {uploadingWallpaper ? 'Enviando...' : 'Selecionar arquivo'}
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    id="wallpaper-upload-create"
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setWallpaperFileToUpload(file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('wallpaper-upload-create')?.click()}>
                                                    Selecionar arquivo
                                                </Button>
                                                {wallpaperFileToUpload && (
                                                    <span className="text-sm text-muted-foreground">
                                                        {wallpaperFileToUpload.name}
                                                        <button type="button" onClick={() => setWallpaperFileToUpload(null)} className="ml-2 text-red-600 hover:underline text-xs">Remover</button>
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                {editingLab && (
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="default_wallpaper_enabled"
                                            checked={wallpaperEnabled ?? true}
                                            onCheckedChange={(c) => setValue('default_wallpaper_enabled', c === true)}
                                        />
                                        <Label htmlFor="default_wallpaper_enabled" className="text-sm font-normal cursor-pointer">Utilizar papel de parede nos computadores do laboratório</Label>
                                    </div>
                                )}
                                <Button type="submit" disabled={isSubmitting}>{editingLab ? 'Salvar' : 'Criar'}</Button>
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
                            placeholder="Buscar por nome ou descrição..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
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
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('id')}>
                                        ID
                                        {sortBy === 'id' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('name')}>
                                        Nome
                                        {sortBy === 'name' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('description')}>
                                        Descrição
                                        {sortBy === 'description' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" className="-ml-3 h-8 font-semibold" onClick={() => handleSort('computers_count')}>
                                        Computadores
                                        {sortBy === 'computers_count' && (sortDir === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
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
                            {labs.map((lab) => (
                                <TableRow key={lab.id}>
                                    <TableCell className="font-mono text-xs">{lab.id}</TableCell>
                                    <TableCell className="font-medium">{lab.name}</TableCell>
                                    <TableCell>{lab.description}</TableCell>
                                    <TableCell>{lab.computers_count || 0}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {lab.updated_at ? new Date(lab.updated_at).toLocaleString('pt-BR') : '-'}
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
                                                <DropdownMenuItem onClick={() => navigate(`/admin/labs/${lab.id}`)}>
                                                    Ver Detalhes
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setEditingLab(lab); reset({ name: lab.name, description: lab.description ?? '', default_wallpaper_url: lab.default_wallpaper_url ?? '', default_wallpaper_enabled: lab.default_wallpaper_enabled ?? true }); setWallpaperFileToUpload(null); setIsOpen(true); }}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => setLabToDelete(lab)} 
                                                    className="text-red-600"
                                                >
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {labs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Nenhum laboratório encontrado.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {viewMode === 'grid' && (
                <>
                    {labs.length === 0 ? (
                        <div className="border rounded-md flex items-center justify-center h-24 text-muted-foreground">
                            Nenhum laboratório encontrado.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {labs.map((lab) => (
                                <div
                                    key={lab.id}
                                    className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow flex flex-col gap-3"
                                >
                                    <div className="font-semibold text-base truncate" title={lab.name}>
                                        {lab.name}
                                    </div>
                                    {lab.description != null && lab.description !== '' && (
                                        <div className="text-sm text-muted-foreground line-clamp-2" title={lab.description}>
                                            {lab.description}
                                        </div>
                                    )}
                                    <div className="text-sm text-muted-foreground">
                                        {lab.computers_count ?? 0} computador(es)
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {lab.updated_at ? new Date(lab.updated_at).toLocaleString('pt-BR') : '-'}
                                    </div>
                                    <div className="flex gap-2 mt-auto pt-2 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => navigate(`/admin/labs/${lab.id}`)}
                                        >
                                            Ver Detalhes
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { setEditingLab(lab); reset({ name: lab.name, description: lab.description ?? '', default_wallpaper_url: lab.default_wallpaper_url ?? '', default_wallpaper_enabled: lab.default_wallpaper_enabled ?? true }); setWallpaperFileToUpload(null); setIsOpen(true); }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => setLabToDelete(lab)}
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
                            Mostrando {pagination.from} a {pagination.to} de {pagination.total} laboratórios
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
                        Mostrando {pagination.total} {pagination.total === 1 ? 'laboratório' : 'laboratórios'}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={labToDelete !== null} onOpenChange={(open) => !open && setLabToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o laboratório <strong>{labToDelete?.name}</strong>?
                            <br />
                            {labToDelete && labToDelete.computers_count && labToDelete.computers_count > 0 && (
                                <span className="text-orange-600 font-semibold">
                                    Atenção: Este laboratório possui {labToDelete.computers_count} computador(es) associado(s).
                                </span>
                            )}
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
