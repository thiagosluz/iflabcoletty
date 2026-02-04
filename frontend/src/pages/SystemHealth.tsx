import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database, HardDrive, Activity, Server, AlertTriangle, CheckCircle2, XCircle, Loader2, TrendingUp, HardDriveIcon, RotateCw, Trash2, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
// Alert component - using Card instead

interface SystemHealth {
    database: {
        driver: string;
        connected: boolean;
        size: string;
        size_bytes: number;
        top_tables?: Array<{
            name: string;
            size: string;
            size_bytes: number;
        }>;
        connection?: {
            host: string;
            port: number;
            database: string;
        };
        error?: string;
    };
    storage: {
        backups: {
            total_backups: number;
            completed: number;
            pending: number;
            failed: number;
            total_size_bytes: number;
            total_size: string;
            disk_usage_bytes: number;
            disk_usage: string;
        };
        logs: {
            total_size_bytes: number;
            total_size: string;
            recent_files?: Array<{
                name: string;
                size: string;
                size_bytes: number;
                modified: string;
            }>;
        };
        storage: {
            total_bytes: number;
            total: string;
            free_bytes: number;
            free: string;
            used_bytes: number;
            used: string;
            usage_percent: number;
        };
    };
    queue: {
        driver: string;
        connected: boolean;
        queue_sizes?: Record<string, number>;
        total_pending?: number;
        failed_jobs: number;
        error?: string;
    };
    cache: {
        driver: string;
        connected: boolean;
        working?: boolean;
        memory_used?: string;
        memory_used_bytes?: number;
        error?: string;
    };
    system: {
        available: boolean;
        load_average?: {
            '1min': number;
            '5min': number;
            '15min': number;
        };
        memory?: {
            total_bytes: number;
            total: string;
            available_bytes: number;
            available: string;
            used_bytes: number;
            used: string;
            usage_percent: number;
        };
        error?: string;
    };
    alerts: Array<{
        level: 'critical' | 'warning' | 'info';
        type: string;
        message: string;
        details?: string;
    }>;
    timestamp: string;
}

export default function SystemHealth() {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [queueActionLoading, setQueueActionLoading] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchHealth = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/system/health');
            setHealth(response.data);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Erro ao buscar métricas do sistema:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusBadge = (connected: boolean) => {
        if (connected) {
            return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Online</Badge>;
        }
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Offline</Badge>;
    };

    const getAlertVariant = (level: string) => {
        switch (level) {
            case 'critical':
                return 'destructive';
            case 'warning':
                return 'default';
            default:
                return 'default';
        }
    };

    const handleRetryFailedJobs = async () => {
        try {
            setQueueActionLoading('retry');
            const response = await apiClient.post('/system/queue/retry-failed');
            toast({
                title: 'Sucesso',
                description: response.data.message,
            });
            // Refresh health data
            await fetchHealth();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setQueueActionLoading(null);
        }
    };

    const handleClearQueue = async (queue: string = 'default') => {
        try {
            setQueueActionLoading('clear');
            const response = await apiClient.post('/system/queue/clear', { queue });
            toast({
                title: 'Sucesso',
                description: response.data.message,
            });
            // Refresh health data
            await fetchHealth();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setQueueActionLoading(null);
        }
    };

    const handleDeleteQueue = async (queue: string = 'default') => {
        try {
            setQueueActionLoading('delete');
            const response = await apiClient.post('/system/queue/delete', { queue });
            toast({
                title: 'Sucesso',
                description: response.data.message,
            });
            // Refresh health data
            await fetchHealth();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setQueueActionLoading(null);
        }
    };

    if (loading && !health) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <div className="text-gray-500">Carregando métricas do sistema...</div>
                </div>
            </div>
        );
    }

    if (!health) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-red-500">Erro ao carregar métricas do sistema</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Saúde do Sistema</h1>
                    <p className="text-muted-foreground mt-1">
                        Monitoramento e métricas do Lab Manager
                        {lastUpdate && (
                            <span className="ml-2 text-xs">
                                (Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')})
                            </span>
                        )}
                    </p>
                </div>
                <Button onClick={fetchHealth} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {/* Alerts */}
            {health.alerts && health.alerts.length > 0 && (
                <div className="space-y-2">
                    {health.alerts.map((alert, index) => {
                        const bgColor = alert.level === 'critical' ? 'bg-red-50 border-red-200' : 
                                       alert.level === 'warning' ? 'bg-yellow-50 border-yellow-200' : 
                                       'bg-blue-50 border-blue-200';
                        const textColor = alert.level === 'critical' ? 'text-red-800' : 
                                         alert.level === 'warning' ? 'text-yellow-800' : 
                                         'text-blue-800';
                        return (
                            <Card key={index} className={`${bgColor} border-2`}>
                                <CardContent className="pt-6">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className={`h-5 w-5 ${textColor} mt-0.5`} />
                                        <div className="flex-1">
                                            <p className={`font-semibold capitalize ${textColor}`}>{alert.level}</p>
                                            <p className={`text-sm ${textColor} mt-1`}>
                                                <strong>{alert.type}:</strong> {alert.message}
                                                {alert.details && <div className="mt-1">{alert.details}</div>}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Database Metrics */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            <CardTitle>Banco de Dados</CardTitle>
                        </div>
                        {getStatusBadge(health.database.connected)}
                    </div>
                    <CardDescription>
                        {health.database.driver?.toUpperCase()} - {health.database.connection?.host}:{health.database.connection?.port}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Tamanho Total</p>
                            <p className="text-2xl font-bold">{health.database.size}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Banco de Dados</p>
                            <p className="text-lg font-medium">{health.database.connection?.database}</p>
                        </div>
                        {health.database.error && (
                            <div>
                                <p className="text-sm text-red-500">Erro</p>
                                <p className="text-sm">{health.database.error}</p>
                            </div>
                        )}
                    </div>
                    {health.database.top_tables && health.database.top_tables.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm font-medium mb-2">Maiores Tabelas</p>
                            <div className="space-y-1">
                                {health.database.top_tables.slice(0, 5).map((table, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{table.name}</span>
                                        <span className="font-medium">{table.size}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Storage Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <HardDrive className="h-5 w-5" />
                            <CardTitle>Armazenamento</CardTitle>
                        </div>
                        <CardDescription>Disco do servidor</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-muted-foreground">Uso do Disco</span>
                                    <span className="text-sm font-medium">{health.storage.storage.usage_percent.toFixed(1)}%</span>
                                </div>
                                <Progress value={health.storage.storage.usage_percent} className="h-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Total</p>
                                    <p className="font-medium">{health.storage.storage.total}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Usado</p>
                                    <p className="font-medium">{health.storage.storage.used}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Livre</p>
                                    <p className="font-medium">{health.storage.storage.free}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <HardDriveIcon className="h-5 w-5" />
                            <CardTitle>Backups</CardTitle>
                        </div>
                        <CardDescription>Armazenamento de backups</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Total</p>
                                    <p className="text-2xl font-bold">{health.storage.backups.total_backups}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Tamanho</p>
                                    <p className="text-lg font-medium">{health.storage.backups.total_size}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Concluídos</p>
                                    <p className="font-medium text-green-600">{health.storage.backups.completed}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Falhados</p>
                                    <p className="font-medium text-red-600">{health.storage.backups.failed}</p>
                                </div>
                            </div>
                            {health.storage.backups.disk_usage_bytes > 0 && (
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">Uso em disco: {health.storage.backups.disk_usage}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Logs */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        <CardTitle>Logs</CardTitle>
                    </div>
                    <CardDescription>Tamanho total dos arquivos de log</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Tamanho Total</p>
                            <p className="text-2xl font-bold">{health.storage.logs.total_size}</p>
                        </div>
                        {health.storage.logs.recent_files && health.storage.logs.recent_files.length > 0 && (
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-2">Arquivos Recentes</p>
                                <div className="space-y-1">
                                    {health.storage.logs.recent_files.slice(0, 3).map((file, idx) => (
                                        <div key={idx} className="text-xs">
                                            <span className="text-muted-foreground">{file.name}</span>
                                            <span className="ml-2">{file.size}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Queue & Cache */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Server className="h-5 w-5" />
                                <CardTitle>Fila de Jobs</CardTitle>
                            </div>
                            {getStatusBadge(health.queue.connected)}
                        </div>
                        <CardDescription>Driver: {health.queue.driver}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {health.queue.total_pending !== undefined && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Pendentes</p>
                                    <p className="text-2xl font-bold">{health.queue.total_pending}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-muted-foreground">Falhados</p>
                                <p className={`text-lg font-medium ${health.queue.failed_jobs > 0 ? 'text-red-600' : ''}`}>
                                    {health.queue.failed_jobs}
                                </p>
                            </div>
                            {health.queue.queue_sizes && Object.keys(health.queue.queue_sizes).length > 0 && (
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground mb-2">Por Fila:</p>
                                    <div className="space-y-1">
                                        {Object.entries(health.queue.queue_sizes).map(([queue, size]) => (
                                            <div key={queue} className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">{queue}</span>
                                                <span className="font-medium">{size}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {health.queue.error && (
                                <div className="text-sm text-red-500">{health.queue.error}</div>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="pt-4 border-t space-y-2">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Ações</p>
                                <div className="flex flex-wrap gap-2">
                                    {health.queue.failed_jobs > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleRetryFailedJobs}
                                            disabled={queueActionLoading !== null}
                                            className="flex items-center gap-2"
                                        >
                                            {queueActionLoading === 'retry' ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <RotateCw className="h-3 w-3" />
                                            )}
                                            Tentar Novamente ({health.queue.failed_jobs})
                                        </Button>
                                    )}
                                    {health.queue.total_pending !== undefined && health.queue.total_pending > 0 && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={queueActionLoading !== null}
                                                    className="flex items-center gap-2"
                                                >
                                                    <X className="h-3 w-3" />
                                                    Limpar Fila
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Limpar Fila</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tem certeza que deseja limpar todos os jobs pendentes da fila?
                                                        Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleClearQueue('default')}
                                                        disabled={queueActionLoading === 'clear'}
                                                    >
                                                        {queueActionLoading === 'clear' ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                Limpando...
                                                            </>
                                                        ) : (
                                                            'Limpar'
                                                        )}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                disabled={queueActionLoading !== null}
                                                className="flex items-center gap-2"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Deletar Fila
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Deletar Fila</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta ação irá limpar TODOS os jobs pendentes E falhados da fila.
                                                    Esta ação é irreversível. Tem certeza?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDeleteQueue('default')}
                                                    disabled={queueActionLoading === 'delete'}
                                                    className="bg-red-600 hover:bg-red-700"
                                                >
                                                    {queueActionLoading === 'delete' ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Deletando...
                                                        </>
                                                    ) : (
                                                        'Deletar'
                                                    )}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                <CardTitle>Cache</CardTitle>
                            </div>
                            {getStatusBadge(health.cache.connected)}
                        </div>
                        <CardDescription>Driver: {health.cache.driver}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {health.cache.working !== undefined && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    {health.cache.working ? (
                                        <Badge variant="default" className="bg-green-500">Funcionando</Badge>
                                    ) : (
                                        <Badge variant="destructive">Com Problemas</Badge>
                                    )}
                                </div>
                            )}
                            {health.cache.memory_used && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Memória Usada</p>
                                    <p className="text-lg font-medium">{health.cache.memory_used}</p>
                                </div>
                            )}
                            {health.cache.error && (
                                <div className="text-sm text-red-500">{health.cache.error}</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* System Metrics */}
            {health.system.available && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            <CardTitle>Métricas do Sistema</CardTitle>
                        </div>
                        <CardDescription>CPU e Memória do servidor</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {health.system.load_average && (
                                <div>
                                    <p className="text-sm font-medium mb-2">Load Average</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">1 min</span>
                                            <span className="font-medium">{health.system.load_average['1min'].toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">5 min</span>
                                            <span className="font-medium">{health.system.load_average['5min'].toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">15 min</span>
                                            <span className="font-medium">{health.system.load_average['15min'].toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {health.system.memory && (
                                <div>
                                    <p className="text-sm font-medium mb-2">Memória</p>
                                    <div className="space-y-2">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-xs text-muted-foreground">Uso</span>
                                                <span className="text-xs font-medium">{health.system.memory.usage_percent.toFixed(1)}%</span>
                                            </div>
                                            <Progress value={health.system.memory.usage_percent} className="h-2" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="text-muted-foreground">Total</p>
                                                <p className="font-medium">{health.system.memory.total}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Usado</p>
                                                <p className="font-medium">{health.system.memory.used}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Disponível</p>
                                                <p className="font-medium">{health.system.memory.available}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
