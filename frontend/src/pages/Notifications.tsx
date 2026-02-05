import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Check, X, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
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

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    read: boolean;
    read_at: string | null;
    created_at: string;
    data?: Record<string, unknown>;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export default function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [readFilter, setReadFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
    const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
    const [isDeleteMultipleDialogOpen, setIsDeleteMultipleDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const fetchNotifications = useCallback(async () => {
        try {
            const params: Record<string, string | number | boolean> = {
                page: currentPage,
                per_page: perPage,
            };
            if (readFilter !== 'all') params.read = readFilter === 'read';
            if (typeFilter !== 'all') params.type = typeFilter;

            const { data } = await apiClient.get('/notifications', { params });
            setNotifications(data.data || []);
            setPagination({
                current_page: data.current_page || 1,
                last_page: data.last_page || 1,
                per_page: data.per_page || perPage,
                total: data.total || 0,
                from: data.from || 0,
                to: data.to || 0,
            });
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    }, [currentPage, perPage, readFilter, typeFilter, toast]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1);
    };

    const handleMarkAsRead = async (notification: Notification) => {
        if (notification.read) return;

        try {
            await apiClient.put(`/notifications/${notification.id}/read`);
            setNotifications(prev =>
                prev.map(n =>
                    n.id === notification.id ? { ...n, read: true, read_at: new Date().toISOString() } : n
                )
            );
            toast({ title: 'Sucesso', description: 'Notificação marcada como lida' });
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleMarkAsUnread = async (notification: Notification) => {
        if (!notification.read) return;

        try {
            await apiClient.put(`/notifications/${notification.id}/unread`);
            setNotifications(prev =>
                prev.map(n =>
                    n.id === notification.id ? { ...n, read: false, read_at: null } : n
                )
            );
            toast({ title: 'Sucesso', description: 'Notificação marcada como não lida' });
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await apiClient.post('/notifications/mark-all-read');
            fetchNotifications();
            toast({ title: 'Sucesso', description: 'Todas as notificações marcadas como lidas' });
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleDelete = async (notification: Notification) => {
        try {
            setIsDeleting(true);
            await apiClient.delete(`/notifications/${notification.id}`);
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
            toast({ title: 'Sucesso', description: 'Notificação excluída com sucesso' });
            setIsDeleteDialogOpen(false);
            setNotificationToDelete(null);
            
            // Refresh if we're on the last page and it becomes empty
            if (pagination && notifications.length === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
            } else {
                fetchNotifications();
            }
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteMultiple = async () => {
        if (selectedNotifications.length === 0) return;

        try {
            setIsDeleting(true);
            const { data } = await apiClient.post('/notifications/delete-multiple', {
                ids: selectedNotifications
            });
            setSelectedNotifications([]);
            toast({ 
                title: 'Sucesso', 
                description: data.message || `${selectedNotifications.length} notificação(ões) excluída(s) com sucesso` 
            });
            fetchNotifications();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteAll = async () => {
        try {
            setIsDeleting(true);
            const { data } = await apiClient.post('/notifications/delete-all');
            setSelectedNotifications([]);
            toast({ 
                title: 'Sucesso', 
                description: data.message || 'Todas as notificações foram excluídas' 
            });
            setIsDeleteAllDialogOpen(false);
            fetchNotifications();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedNotifications.length === notifications.length) {
            setSelectedNotifications([]);
        } else {
            setSelectedNotifications(notifications.map(n => n.id));
        }
    };

    const handleSelectNotification = (id: number) => {
        setSelectedNotifications(prev =>
            prev.includes(id)
                ? prev.filter(nId => nId !== id)
                : [...prev, id]
        );
    };

    const getNotificationIcon = (type: string) => {
        if (type.includes('offline')) return '🔴';
        if (type.includes('online')) return '🟢';
        if (type.includes('software')) return '📦';
        if (type.includes('hardware')) return '⚠️';
        return '🔔';
    };

    const getTypeBadge = (type: string) => {
        if (type.includes('computer')) return <Badge variant="outline">Computador</Badge>;
        if (type.includes('software')) return <Badge variant="outline">Software</Badge>;
        if (type.includes('hardware')) return <Badge variant="outline">Hardware</Badge>;
        return <Badge variant="outline">{type}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Notificações</h2>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-white shadow rounded-lg px-4 py-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                        <select
                            value={perPage.toString()}
                            onChange={(e) => handlePerPageChange(e.target.value)}
                            className="border rounded px-2 py-1"
                        >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                    {selectedNotifications.length > 0 && (
                        <Button 
                            onClick={() => setIsDeleteMultipleDialogOpen(true)} 
                            variant="destructive"
                            disabled={isDeleting}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir selecionadas ({selectedNotifications.length})
                        </Button>
                    )}
                    <Button onClick={handleMarkAllAsRead} variant="outline">
                        Marcar todas como lidas
                    </Button>
                    <Button 
                        onClick={() => setIsDeleteAllDialogOpen(true)} 
                        variant="destructive"
                        disabled={notifications.length === 0}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir todas
                    </Button>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4 flex gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Status:</label>
                    <Select value={readFilter} onValueChange={setReadFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="read">Lidas</SelectItem>
                            <SelectItem value="unread">Não lidas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Tipo:</label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="computer.offline">Computador Offline</SelectItem>
                            <SelectItem value="computer.online">Computador Online</SelectItem>
                            <SelectItem value="software.installed">Software Instalado</SelectItem>
                            <SelectItem value="software.removed">Software Removido</SelectItem>
                            <SelectItem value="hardware.cpu_high">CPU Alta</SelectItem>
                            <SelectItem value="hardware.memory_high">Memória Alta</SelectItem>
                            <SelectItem value="hardware.disk_full">Disco Cheio</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedNotifications.length === notifications.length && notifications.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Mensagem</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[150px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {notifications.map((notification) => (
                            <TableRow
                                key={notification.id}
                                className={!notification.read ? 'bg-blue-50' : ''}
                            >
                                <TableCell>
                                    <Checkbox
                                        checked={selectedNotifications.includes(notification.id)}
                                        onCheckedChange={() => handleSelectNotification(notification.id)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <span className="text-xl">
                                        {getNotificationIcon(notification.type)}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {getTypeBadge(notification.type)}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {notification.title}
                                </TableCell>
                                <TableCell className="max-w-md truncate">
                                    {notification.message}
                                </TableCell>
                                <TableCell>
                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </TableCell>
                                <TableCell>
                                    {notification.read ? (
                                        <Badge variant="secondary">Lida</Badge>
                                    ) : (
                                        <Badge variant="default">Não lida</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        {notification.read ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleMarkAsUnread(notification)}
                                                title="Marcar como não lida"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleMarkAsRead(notification)}
                                                title="Marcar como lida"
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setNotificationToDelete(notification);
                                                setIsDeleteDialogOpen(true);
                                            }}
                                            title="Excluir notificação"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {notifications.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24">
                                    Nenhuma notificação encontrada.
                                </TableCell>
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
                            Mostrando {pagination.from} a {pagination.to} de {pagination.total} notificações
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
                    Mostrando {pagination.total} {pagination.total === 1 ? 'notificação' : 'notificações'}
                </div>
            )}

            {/* Delete Single Notification Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Notificação</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a notificação "{notificationToDelete?.title}"? 
                            Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => notificationToDelete && handleDelete(notificationToDelete)}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Multiple Notifications Dialog */}
            <AlertDialog open={isDeleteMultipleDialogOpen} onOpenChange={setIsDeleteMultipleDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Notificações Selecionadas</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir {selectedNotifications.length} notificação(ões) selecionada(s)? 
                            Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setIsDeleteMultipleDialogOpen(false);
                                handleDeleteMultiple();
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete All Notifications Dialog */}
            <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Todas as Notificações</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir todas as notificações? 
                            Esta ação não pode ser desfeita e irá excluir {pagination?.total || 0} notificação(ões).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAll}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? 'Excluindo...' : 'Excluir Todas'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
