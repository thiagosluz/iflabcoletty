import { useState, useEffect } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import echo from '@/lib/echo';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    data?: Record<string, any>;
}

export default function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUnreadCount();
    }, []);

    useEffect(() => {
        // Listen for new notifications via WebSocket
        const token = localStorage.getItem('token');
        if (!token) return;

        let userChannel: any = null;
        let notificationsChannel: any = null;
        let userId: number | null = null;

        // Fetch user info to get ID and set up listeners
        apiClient.get('/me')
            .then(({ data }) => {
                userId = data.id;
                if (!userId) {
                    console.error('No user ID found');
                    return;
                }

                console.log('Setting up WebSocket listeners for user:', userId);

                // Listen to user-specific channel
                userChannel = echo.private(`user.${userId}`);
                
                userChannel.subscribed(() => {
                    console.log('Subscribed to user channel:', `user.${userId}`);
                });

                userChannel.error((error: any) => {
                    console.error('Error subscribing to user channel:', error);
                    console.error('Error details:', JSON.stringify(error, null, 2));
                });

                userChannel.listen('.notification.created', (eventData: any) => {
                    console.log('Notification received on user channel:', eventData);
                    // The event data is the notification object directly (from broadcastWith)
                    const notification: Notification = {
                        id: eventData.id,
                        type: eventData.type,
                        title: eventData.title,
                        message: eventData.message,
                        read: eventData.read || false,
                        created_at: eventData.created_at,
                        data: eventData.data,
                    };
                    setUnreadCount(prev => prev + 1);
                    setNotifications(prev => {
                        // Check if notification already exists to avoid duplicates
                        if (prev.some(n => n.id === notification.id)) {
                            return prev;
                        }
                        return [notification, ...prev];
                    });
                });

                // Listen to general notifications channel
                notificationsChannel = echo.private('notifications');
                
                notificationsChannel.subscribed(() => {
                    console.log('Subscribed to notifications channel');
                });

                notificationsChannel.error((error: any) => {
                    console.error('Error subscribing to notifications channel:', error);
                    console.error('Error details:', JSON.stringify(error, null, 2));
                });

                notificationsChannel.listen('.notification.created', (eventData: any) => {
                    console.log('Notification received on notifications channel:', eventData);
                    // The event data is the notification object directly (from broadcastWith)
                    const notification: Notification = {
                        id: eventData.id,
                        type: eventData.type,
                        title: eventData.title,
                        message: eventData.message,
                        read: eventData.read || false,
                        created_at: eventData.created_at,
                        data: eventData.data,
                    };
                    // Only add if it's for the current user or if it's a general notification
                    // Note: user_id is not in the broadcast data, so we'll accept all from this channel
                    setUnreadCount(prev => prev + 1);
                    setNotifications(prev => {
                        // Check if notification already exists to avoid duplicates
                        if (prev.some(n => n.id === notification.id)) {
                            return prev;
                        }
                        return [notification, ...prev];
                    });
                });
            })
            .catch((error) => {
                console.error('Error fetching user info for WebSocket:', error);
            });

        return () => {
            // Clean up listeners
            if (userChannel) {
                userChannel.stopListening('.notification.created');
                if (userId) {
                    echo.leave(`user.${userId}`);
                }
            }
            if (notificationsChannel) {
                notificationsChannel.stopListening('.notification.created');
                echo.leave('notifications');
            }
        };
    }, []); // Empty dependency array - only run once on mount

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const fetchUnreadCount = async () => {
        try {
            const { data } = await apiClient.get('/notifications/unread-count');
            setUnreadCount(data.count || 0);
        } catch (error) {
            console.error('Erro ao buscar contagem de notificações:', error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const { data } = await apiClient.get('/notifications?per_page=10');
            setNotifications(data.data || []);
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
        }
    };

    const handleMarkAsRead = async (notification: Notification) => {
        if (notification.read) return;

        try {
            await apiClient.put(`/notifications/${notification.id}/read`);
            setNotifications(prev =>
                prev.map(n =>
                    n.id === notification.id ? { ...n, read: true } : n
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await apiClient.post('/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
        }
    };

    const handleDelete = async (notification: Notification, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation when clicking delete
        
        try {
            await apiClient.delete(`/notifications/${notification.id}`);
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
            if (!notification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Erro ao excluir notificação:', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        handleMarkAsRead(notification);

        // Navigate based on notification type
        if (notification.data?.computer_id) {
            navigate(`/admin/computers/${notification.data.computer_id}`);
        } else if (notification.data?.lab_id) {
            navigate(`/admin/labs/${notification.data.lab_id}`);
        }

        setIsOpen(false);
    };

    const getNotificationIcon = (type: string) => {
        if (type.includes('offline')) return '🔴';
        if (type.includes('online')) return '🟢';
        if (type.includes('software')) return '📦';
        if (type.includes('hardware')) return '⚠️';
        return '🔔';
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notificações</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="text-xs"
                        >
                            Marcar todas como lidas
                        </Button>
                    )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                            Nenhuma notificação
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                                        !notification.read ? 'bg-blue-50' : ''
                                    }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-xl">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm">
                                                    {notification.title}
                                                </p>
                                                {!notification.read && (
                                                    <span className="h-2 w-2 bg-blue-500 rounded-full"></span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {formatDistanceToNow(
                                                    new Date(notification.created_at),
                                                    { addSuffix: true, locale: ptBR }
                                                )}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                            onClick={(e) => handleDelete(notification, e)}
                                            title="Excluir notificação"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-2 border-t">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                            setIsOpen(false);
                            navigate('/admin/notifications');
                        }}
                    >
                        Ver todas as notificações
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
