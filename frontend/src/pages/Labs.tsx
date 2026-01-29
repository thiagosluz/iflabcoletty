import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { MoreHorizontal, Plus, ChevronLeft, ChevronRight, Download, Trash2, Pencil } from 'lucide-react';
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

const labSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
});

type LabFormData = z.infer<typeof labSchema>;

export default function Labs() {
    const navigate = useNavigate();
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    const { toast } = useToast();

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LabFormData>({
        resolver: zodResolver(labSchema),
    });

    const fetchLabs = async () => {
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());

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
    }, [currentPage, perPage]);

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing per page
    };

    const onSubmit = async (data: LabFormData) => {
        try {
            if (editingLab) {
                await apiClient.put(`/labs/${editingLab.id}`, data);
                toast({ title: 'Sucesso', description: 'Laboratório atualizado com sucesso' });
            } else {
                await apiClient.post('/labs', data);
                toast({ title: 'Sucesso', description: 'Laboratório criado com sucesso' });
            }
            setIsOpen(false);
            setEditingLab(null);
            reset();
            fetchLabs();
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.response?.data?.message || (editingLab ? 'Falha ao atualizar laboratório' : 'Falha ao criar laboratório'),
                variant: 'destructive'
            });
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
                    <div className="flex items-center gap-2 bg-white shadow rounded-lg px-4 py-2">
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
                    <Button onClick={() => { setEditingLab(null); reset(); setIsOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Laboratório
                    </Button>
                    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setEditingLab(null); reset(); } }}>
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
                                <Button type="submit" disabled={isSubmitting}>{editingLab ? 'Salvar' : 'Criar'}</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Computadores</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {labs.map((lab) => (
                            <TableRow key={lab.id}>
                                <TableCell className="font-medium">{lab.name}</TableCell>
                                <TableCell>{lab.description}</TableCell>
                                <TableCell>{lab.computers_count || 0}</TableCell>
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
                                            <DropdownMenuItem onClick={() => { setEditingLab(lab); reset({ name: lab.name, description: lab.description ?? '' }); setIsOpen(true); }}>
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
                                <TableCell colSpan={4} className="text-center h-24">Nenhum laboratório encontrado.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.last_page > 1 && (
                <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center justify-between">
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
                </div>
            )}

            {/* Info when no pagination needed */}
            {pagination && pagination.last_page === 1 && (
                <div className="text-sm text-gray-500">
                    Mostrando {pagination.total} {pagination.total === 1 ? 'laboratório' : 'laboratórios'}
                </div>
            )}

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
