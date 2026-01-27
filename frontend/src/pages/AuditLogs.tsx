import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Search, Filter, Calendar, Trash2 } from 'lucide-react';
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
import { useDebounce } from '@/lib/utils';

interface AuditLog {
    id: number;
    user_id: number | null;
    action: string;
    resource_type: string;
    resource_id: number | null;
    ip_address: string | null;
    user_agent: string | null;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    description: string | null;
    created_at: string;
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800',
    view: 'bg-gray-100 text-gray-800',
};

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
    const [userIdFilter, setUserIdFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const debouncedSearch = useDebounce(search, 500);

    useEffect(() => {
        fetchLogs();
    }, [currentPage, perPage, debouncedSearch, actionFilter, resourceTypeFilter, userIdFilter, dateFrom, dateTo]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params: Record<string, any> = {
                page: currentPage,
                per_page: perPage,
            };

            if (debouncedSearch) params.search = debouncedSearch;
            if (actionFilter !== 'all') params.action = actionFilter;
            if (resourceTypeFilter !== 'all') params.resource_type = resourceTypeFilter;
            if (userIdFilter !== 'all') params.user_id = userIdFilter;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            const { data } = await apiClient.get('/audit-logs', { params });
            setLogs(data.data || []);
            setPagination({
                current_page: data.current_page,
                last_page: data.last_page,
                per_page: data.per_page,
                total: data.total,
                from: data.from,
                to: data.to,
            });
        } catch (error) {
            console.error('Erro ao buscar logs de auditoria:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAll = async () => {
        try {
            await apiClient.delete('/audit-logs');
            fetchLogs();
            // Optional: Add toast notification here
        } catch (error) {
            console.error('Erro ao excluir logs:', error);
            // Optional: Add error toast here
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR');
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            create: 'Criar',
            update: 'Atualizar',
            delete: 'Remover',
            view: 'Visualizar',
        };
        return labels[action] || action;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Logs de Auditoria</h1>
                    <p className="text-muted-foreground">
                        Registro de todas as ações realizadas no sistema
                    </p>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Todos
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso excluirá permanentemente todos os logs de auditoria do sistema.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
                                Confirmar Exclusão
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Filtre os logs por diferentes critérios</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ação" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as ações</SelectItem>
                                <SelectItem value="create">Criar</SelectItem>
                                <SelectItem value="update">Atualizar</SelectItem>
                                <SelectItem value="delete">Remover</SelectItem>
                                <SelectItem value="view">Visualizar</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tipo de recurso" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os recursos</SelectItem>
                                <SelectItem value="Lab">Laboratório</SelectItem>
                                <SelectItem value="Computer">Computador</SelectItem>
                                <SelectItem value="Software">Software</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex gap-2">
                            <Input
                                type="date"
                                placeholder="Data inicial"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="flex-1"
                            />
                            <Input
                                type="date"
                                placeholder="Data final"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Registros de Auditoria</CardTitle>
                    <CardDescription>
                        {pagination && `${pagination.from}-${pagination.to} de ${pagination.total} registros`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Carregando...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum log de auditoria encontrado
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data/Hora</TableHead>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Ação</TableHead>
                                            <TableHead>Recurso</TableHead>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead>IP</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {formatDate(log.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    {log.user ? (
                                                        <div>
                                                            <div className="font-medium">{log.user.name}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {log.user.email}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">Sistema</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                                                        {getActionLabel(log.action)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{log.resource_type}</div>
                                                        {log.resource_id && (
                                                            <div className="text-sm text-muted-foreground">
                                                                ID: {log.resource_id}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    <div className="truncate" title={log.description || ''}>
                                                        {log.description || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {log.ip_address || '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

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
                                            <ChevronLeft className="h-4 w-4" />
                                            Anterior
                                        </Button>

                                        {/* Números de página */}
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                                                let pageNum: number;
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
                                                        className="w-10"
                                                        onClick={() => setCurrentPage(pageNum)}
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.min(pagination.last_page, p + 1))}
                                            disabled={currentPage === pagination.last_page}
                                        >
                                            Próxima
                                            <ChevronRight className="h-4 w-4" />
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
