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
import echo, { isEchoConnected } from '@/lib/echo';

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
        if (!token) {
            console.log('NotificationBell: No token found, skipping WebSocket setup');
            return;
        }

        let userChannel: any = null;
        let notificationsChannel: any = null;
        let userId: number | null = null;

        // Helper function to handle notification received
        const handleNotificationReceived = (eventData: any, source: string) => {
            console.log(`Notification received on ${source}:`, eventData);
            
            // Filter notifications by user_id if available
            if (eventData.user_id && userId && eventData.user_id !== userId) {
                console.log(`Notification filtered out: user_id mismatch (${eventData.user_id} !== ${userId})`);
                return;
            }

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

            setNotifications(prev => {
                // Check if notification already exists to avoid duplicates
                if (prev.some(n => n.id === notification.id)) {
                    console.log(`Notification ${notification.id} already exists, skipping`);
                    return prev;
                }
                console.log(`Adding new notification ${notification.id} to list`);
                return [notification, ...prev];
            });

            // Only increment unread count if notification is not read
            if (!notification.read) {
                setUnreadCount(prev => {
                    const newCount = prev + 1;
                    console.log(`Unread count updated: ${prev} -> ${newCount}`);
                    return newCount;
                });
            }
        };

        // Fetch user info to get ID and set up listeners
        apiClient.get('/me')
            .then(({ data }) => {
                userId = data.id;
                if (!userId) {
                    console.error('NotificationBell: No user ID found');
                    return;
                }

                console.log('NotificationBell: Setting up WebSocket listeners for user:', userId);

                // Wait a bit to ensure Echo is connected
                const setupChannels = () => {
                    // Check if Echo is connected
                    if (!isEchoConnected()) {
                        console.warn('NotificationBell: Echo not connected yet, retrying in 500ms...');
                        setTimeout(setupChannels, 500);
                        return;
                    }

                    try {
                        console.log('NotificationBell: Echo is connected, setting up channels');
                        // Listen to user-specific channel
                        userChannel = echo.private(`user.${userId}`);
                        
                        userChannel.subscribed(() => {
                            console.log('NotificationBell: Subscribed to user channel:', `user.${userId}`);
                        });

                        userChannel.error((error: any) => {
                            console.error('NotificationBell: Error subscribing to user channel:', error);
                            console.error('NotificationBell: Error details:', JSON.stringify(error, null, 2));
                        });

                        // Try both event name formats
                        // Format 1: with dot prefix (Laravel Echo namespace)
                        userChannel.listen('.notification.created', (eventData: any) => {
                            handleNotificationReceived(eventData, 'user channel (dot format)');
                        });

                        // Format 2: without dot prefix (direct event name)
                        userChannel.listen('notification.created', (eventData: any) => {
                            handleNotificationReceived(eventData, 'user channel (direct format)');
                        });

                        // Also listen to App.Models.User channel format
                        const appUserChannel = echo.private(`App.Models.User.${userId}`);
                        appUserChannel.subscribed(() => {
                            console.log('NotificationBell: Subscribed to App.Models.User channel:', `App.Models.User.${userId}`);
                        });
                        appUserChannel.listen('.notification.created', (eventData: any) => {
                            handleNotificationReceived(eventData, 'App.Models.User channel');
                        });
                        appUserChannel.listen('notification.created', (eventData: any) => {
                            handleNotificationReceived(eventData, 'App.Models.User channel (direct)');
                        });

                        // Listen to general notifications channel
                        notificationsChannel = echo.private('notifications');
                        
                        notificationsChannel.subscribed(() => {
                            console.log('NotificationBell: Subscribed to notifications channel');
                        });

                        notificationsChannel.error((error: any) => {
                            console.error('NotificationBell: Error subscribing to notifications channel:', error);
                            console.error('NotificationBell: Error details:', JSON.stringify(error, null, 2));
                        });

                        notificationsChannel.listen('.notification.created', (eventData: any) => {
                            handleNotificationReceived(eventData, 'notifications channel (dot format)');
                        });

                        notificationsChannel.listen('notification.created', (eventData: any) => {
                            handleNotificationReceived(eventData, 'notifications channel (direct format)');
                        });
                    } catch (error) {
                        console.error('NotificationBell: Error setting up channels:', error);
                    }
                };

                // Try to setup immediately, but also retry after a short delay
                setupChannels();
                setTimeout(setupChannels, 1000);
            })
            .catch((error) => {
                console.error('NotificationBell: Error fetching user info for WebSocket:', error);
            });

        return () => {
            // Clean up listeners
            console.log('NotificationBell: Cleaning up WebSocket listeners');
            if (userChannel) {
                try {
                    userChannel.stopListening('.notification.created');
                    userChannel.stopListening('notification.created');
                } catch (e) {
                    console.warn('NotificationBell: Error stopping user channel listeners:', e);
                }
                if (userId) {
                    try {
                        echo.leave(`user.${userId}`);
                        echo.leave(`App.Models.User.${userId}`);
                    } catch (e) {
                        console.warn('NotificationBell: Error leaving user channels:', e);
                    }
                }
            }
            if (notificationsChannel) {
                try {
                    notificationsChannel.stopListening('.notification.created');
                    notificationsChannel.stopListening('notification.created');
                    echo.leave('notifications');
                } catch (e) {
                    console.warn('NotificationBell: Error cleaning up notifications channel:', e);
                }
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
