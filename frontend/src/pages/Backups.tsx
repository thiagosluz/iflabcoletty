import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Download, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Plus, Trash2, Database, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Backup {
    id: number;
    filename: string;
    file_path: string;
    file_size: string;
    file_size_human?: string;
    type: 'database' | 'full';
    status: 'pending' | 'completed' | 'failed';
    error_message: string | null;
    user: {
        id: number;
        name: string;
        email: string;
    } | null;
    completed_at: string | null;
    created_at: string;
    download_url: string | null;
    file_exists: boolean;
}

interface BackupStats {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    total_size: number;
    total_size_human: string;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export default function Backups() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [stats, setStats] = useState<BackupStats | null>(null);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [isRestoring, setIsRestoring] = useState<number | null>(null);
    const { toast } = useToast();

    const fetchBackups = async () => {
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());
            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }
            if (typeFilter !== 'all') {
                params.append('type', typeFilter);
            }
            if (search) {
                params.append('search', search);
            }

            const response = await apiClient.get(`/backups?${params.toString()}`);
            setBackups(response.data.data || []);
            setPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || perPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error: any) {
            console.error('Error fetching backups:', error);
            toast({
                title: 'Erro',
                description: error.response?.data?.message || 'Falha ao carregar backups',
                variant: 'destructive',
            });
        }
    };

    const fetchStats = async () => {
        try {
            const response = await apiClient.get('/backups/stats');
            setStats(response.data);
        } catch (error: any) {
            console.error('Error fetching stats:', error);
        }
    };

    useEffect(() => {
        fetchBackups();
        fetchStats();
    }, [currentPage, perPage, statusFilter, typeFilter]);

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            if (currentPage === 1) {
                fetchBackups();
            } else {
                setCurrentPage(1);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    // Poll for pending backups status updates
    useEffect(() => {
        const hasPendingBackups = backups.some(b => b.status === 'pending');
        
        if (!hasPendingBackups) {
            return; // No need to poll if there are no pending backups
        }

        const interval = setInterval(() => {
            fetchBackups();
            fetchStats();
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [backups]);

    const handleCreateBackup = async () => {
        try {
            setIsCreating(true);
            const response = await apiClient.post('/backups', { type: 'database' });
            
            toast({
                title: 'Backup iniciado',
                description: 'O backup está sendo criado...',
            });

            // Refresh after a short delay
            setTimeout(() => {
                fetchBackups();
                fetchStats();
            }, 2000);
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.response?.data?.message || 'Falha ao criar backup',
                variant: 'destructive',
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDownload = async (backup: Backup) => {
        if (!backup.download_url) {
            toast({
                title: 'Erro',
                description: 'Arquivo não disponível para download',
                variant: 'destructive',
            });
            return;
        }

        try {
            const response = await apiClient.get(backup.download_url, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = backup.filename;
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

    const handleDelete = async (backup: Backup) => {
        try {
            setIsDeleting(backup.id);
            await apiClient.delete(`/backups/${backup.id}`);
            
            toast({
                title: 'Backup excluído',
                description: 'Backup excluído com sucesso',
            });

            fetchBackups();
            fetchStats();
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.response?.data?.message || 'Falha ao excluir backup',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(null);
        }
    };

    const handleRestore = async (backup: Backup) => {
        try {
            setIsRestoring(backup.id);
            await apiClient.post(`/backups/${backup.id}/restore`);
            
            toast({
                title: 'Backup restaurado',
                description: 'O banco de dados foi restaurado com sucesso',
            });

            // Refresh immediately and again after a short delay to ensure UI is updated
            await fetchBackups();
            await fetchStats();
            
            // Force another refresh after a delay to catch any status changes
            setTimeout(async () => {
                await fetchBackups();
                await fetchStats();
            }, 1000);
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.response?.data?.message || error.response?.data?.error || 'Falha ao restaurar backup',
                variant: 'destructive',
            });
        } finally {
            setIsRestoring(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            pending: 'secondary',
            completed: 'default',
            failed: 'destructive',
        };

        const icons: Record<string, React.ReactNode> = {
            pending: <Clock className="h-3 w-3 mr-1" />,
            completed: <CheckCircle2 className="h-3 w-3 mr-1" />,
            failed: <XCircle className="h-3 w-3 mr-1" />,
        };

        const labels: Record<string, string> = {
            pending: 'Pendente',
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
            database: 'Banco de Dados',
            full: 'Completo',
        };
        return labels[type] || type;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Backups</h2>
                    <p className="text-muted-foreground mt-1">
                        Gerencie os backups do banco de dados
                    </p>
                </div>
                <Button onClick={handleCreateBackup} disabled={isCreating}>
                    {isCreating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Criando...
                        </>
                    ) : (
                        <>
                            <Plus className="mr-2 h-4 w-4" />
                            Criar Backup
                        </>
                    )}
                </Button>
            </div>

            {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground">Backups criados</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.completed}</div>
                            <p className="text-xs text-muted-foreground">Backups bem-sucedidos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Falhados</CardTitle>
                            <XCircle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.failed}</div>
                            <p className="text-xs text-muted-foreground">Backups com erro</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tamanho Total</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total_size_human}</div>
                            <p className="text-xs text-muted-foreground">Armazenamento usado</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Backups</CardTitle>
                    <CardDescription>
                        Visualize e gerencie todos os backups criados
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-4">
                        <Input
                            placeholder="Buscar por nome do arquivo..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Status</SelectItem>
                                <SelectItem value="completed">Concluído</SelectItem>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="failed">Falhou</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Tipos</SelectItem>
                                <SelectItem value="database">Banco de Dados</SelectItem>
                                <SelectItem value="full">Completo</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => { fetchBackups(); fetchStats(); }}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Atualizar
                        </Button>
                    </div>

                    {backups.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum backup encontrado
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Arquivo</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Tamanho</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Criado por</TableHead>
                                        <TableHead>Criado em</TableHead>
                                        <TableHead>Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {backups.map((backup) => (
                                        <TableRow key={backup.id}>
                                            <TableCell className="font-medium">#{backup.id}</TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {backup.filename}
                                            </TableCell>
                                            <TableCell>{getTypeLabel(backup.type)}</TableCell>
                                            <TableCell>
                                                {backup.file_size_human || backup.file_size || '-'}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(backup.status)}</TableCell>
                                            <TableCell>
                                                {backup.user ? backup.user.name : 'Sistema'}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(backup.created_at).toLocaleString('pt-BR')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {backup.status === 'completed' && backup.download_url && backup.file_exists ? (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDownload(backup)}
                                                            >
                                                                <Download className="h-4 w-4 mr-1" />
                                                                Download
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="default"
                                                                        disabled={isRestoring === backup.id}
                                                                    >
                                                                        {isRestoring === backup.id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <>
                                                                                <RotateCcw className="h-4 w-4 mr-1" />
                                                                                Restaurar
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Confirmar restauração</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Tem certeza que deseja restaurar o banco de dados a partir do backup "{backup.filename}"?
                                                                            <br />
                                                                            <strong className="text-destructive">ATENÇÃO:</strong> Esta ação irá substituir todos os dados atuais do banco de dados pelos dados do backup. Esta ação não pode ser desfeita.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleRestore(backup)}
                                                                            className="bg-blue-600 text-white hover:bg-blue-700"
                                                                        >
                                                                            Restaurar
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    ) : backup.status === 'failed' ? (
                                                        <span className="text-sm text-destructive">
                                                            {backup.error_message || 'Erro desconhecido'}
                                                        </span>
                                                    ) : null}
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                disabled={isDeleting === backup.id}
                                                            >
                                                                {isDeleting === backup.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Tem certeza que deseja excluir o backup "{backup.filename}"?
                                                                    Esta ação não pode ser desfeita.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleDelete(backup)}
                                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                >
                                                                    Excluir
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
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
        </div>
    );
}
