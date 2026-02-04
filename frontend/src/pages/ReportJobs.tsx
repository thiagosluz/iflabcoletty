import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

interface ReportJob {
    id: number;
    type: 'labs' | 'computers' | 'softwares' | 'lab_details';
    format: 'pdf' | 'csv' | 'xlsx';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    file_path: string | null;
    download_url: string | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    created_at: string;
    filters: Record<string, any>;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export default function ReportJobs() {
    const [jobs, setJobs] = useState<ReportJob[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
    const [jobToDelete, setJobToDelete] = useState<ReportJob | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const fetchJobs = async (silent = false) => {
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());

            const response = await apiClient.get(`/reports/jobs?${params.toString()}`);
            setJobs(response.data.data || []);
            setPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || perPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error: any) {
            // Don't show toast for rate limit errors during polling
            if (error.response?.status === 429) {
                console.warn('Rate limit reached, will retry later');
                // Stop polling if rate limited
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                if (!silent) {
                    toast({ ...getApiErrorToast(error) });
                }
                return;
            }
            
            console.error('Error fetching jobs:', error);
            if (!silent) {
                toast({ ...getApiErrorToast(error) });
            }
        }
    };

    useEffect(() => {
        fetchJobs();
    }, [currentPage, perPage]);

    // Poll for pending/processing jobs
    useEffect(() => {
        const hasActiveJobs = jobs.some(job => job.status === 'pending' || job.status === 'processing');
        
        // Clear any existing interval first
        if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
        
        if (hasActiveJobs) {
            const interval = setInterval(() => {
                fetchJobs(true); // Silent mode for polling to avoid toast spam
            }, 10000); // Poll every 10 seconds to avoid rate limiting (60 req/min = 1 req/sec max)
            setPollingInterval(interval);
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [jobs]); // Only depend on jobs, not pollingInterval

    const handleDownload = async (job: ReportJob) => {
        if (!job.download_url) {
            toast({
                title: 'Erro',
                description: 'Arquivo não disponível para download',
                variant: 'destructive',
            });
            return;
        }

        try {
            const response = await apiClient.get(job.download_url, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            const extension = job.format;
            const typeName = {
                labs: 'laboratorios',
                computers: 'computadores',
                softwares: 'softwares',
                lab_details: 'lab-detalhes',
            }[job.type] || 'relatorio';
            
            link.download = `${typeName}-${job.id}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast({
                title: 'Download iniciado',
                description: 'Arquivo sendo baixado...',
            });
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.response?.data?.message || 'Falha ao baixar arquivo',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async () => {
        if (!jobToDelete) return;
        try {
            setIsDeleting(true);
            await apiClient.delete(`/reports/jobs/${jobToDelete.id}`);
            toast({ title: 'Excluído', description: 'Relatório excluído com sucesso.' });
            setJobToDelete(null);
            await fetchJobs(false);
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            pending: 'secondary',
            processing: 'default',
            completed: 'default',
            failed: 'destructive',
        };

        const icons: Record<string, React.ReactNode> = {
            pending: <Clock className="h-3 w-3 mr-1" />,
            processing: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
            completed: <CheckCircle2 className="h-3 w-3 mr-1" />,
            failed: <XCircle className="h-3 w-3 mr-1" />,
        };

        const labels: Record<string, string> = {
            pending: 'Pendente',
            processing: 'Processando',
            completed: 'Concluído',
            failed: 'Falhou',
        };

        return (
            <Badge variant={variants[status] || 'default'}>
                {icons[status]}
                {labels[status] || status}
            </Badge>
        );
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            labs: 'Laboratórios',
            computers: 'Computadores',
            softwares: 'Softwares',
            lab_details: 'Detalhes do laboratório',
        };
        return labels[type] || type;
    };

    const getFormatLabel = (format: string) => {
        return format.toUpperCase();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Relatórios em Processamento</h2>
                    <p className="text-muted-foreground mt-1">
                        Acompanhe o status dos seus relatórios exportados
                    </p>
                </div>
                <Button variant="outline" onClick={() => fetchJobs(false)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Atualizar
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Meus Relatórios</CardTitle>
                    <CardDescription>
                        Lista de todos os relatórios que você solicitou
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {jobs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum relatório encontrado
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Formato</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Criado em</TableHead>
                                        <TableHead>Concluído em</TableHead>
                                        <TableHead>Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobs.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell className="font-medium">#{job.id}</TableCell>
                                            <TableCell>{getTypeLabel(job.type)}</TableCell>
                                            <TableCell>{getFormatLabel(job.format)}</TableCell>
                                            <TableCell>{getStatusBadge(job.status)}</TableCell>
                                            <TableCell>
                                                {new Date(job.created_at).toLocaleString('pt-BR')}
                                            </TableCell>
                                            <TableCell>
                                                {job.completed_at
                                                    ? new Date(job.completed_at).toLocaleString('pt-BR')
                                                    : job.failed_at
                                                    ? new Date(job.failed_at).toLocaleString('pt-BR')
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {job.status === 'completed' && job.download_url ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDownload(job)}
                                                        >
                                                            <Download className="h-4 w-4 mr-1" />
                                                            Download
                                                        </Button>
                                                    ) : job.status === 'failed' ? (
                                                        <span className="text-sm text-destructive">
                                                            {job.error_message || 'Erro desconhecido'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">
                                                            Aguardando...
                                                        </span>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setJobToDelete(job)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Excluir
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {pagination && pagination.last_page > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-muted-foreground">
                                            Mostrando {pagination.from} a {pagination.to} de {pagination.total} registros
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Itens por página:</span>
                                            <Select
                                                value={perPage.toString()}
                                                onValueChange={(value) => {
                                                    setPerPage(Number(value));
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <SelectTrigger className="w-20">
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
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                        >
                                            Primeira
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Anterior
                                        </Button>
                                        <span className="text-sm">
                                            Página {pagination.current_page} de {pagination.last_page}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.min(pagination.last_page, p + 1))}
                                            disabled={currentPage === pagination.last_page}
                                        >
                                            Próxima
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(pagination.last_page)}
                                            disabled={currentPage === pagination.last_page}
                                        >
                                            Última
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={jobToDelete !== null} onOpenChange={(open) => !open && setJobToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir relatório</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este relatório? O job será removido da lista
                            {jobToDelete?.status === 'completed' && jobToDelete?.file_path && ' e o arquivo gerado será apagado'}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
