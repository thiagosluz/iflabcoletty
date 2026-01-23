import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Activity, Server, Cpu, MemoryStick, HardDrive, Package } from 'lucide-react';

interface HardwareAverages {
    cpu?: {
        avg_physical_cores?: number;
        avg_logical_cores?: number;
    };
    memory?: {
        avg_total_gb?: number;
    };
    disk?: {
        avg_total_gb?: number;
        avg_used_gb?: number;
        avg_free_gb?: number;
        avg_usage_percent?: number;
    };
    computers_with_hardware_info?: number;
}

interface OSDistribution {
    system: string;
    release: string;
    count: number;
}

interface Stats {
    total_labs: number;
    total_computers: number;
    online_computers: number;
    offline_computers: number;
    total_softwares?: number;
    hardware_averages?: HardwareAverages | null;
    os_distribution?: OSDistribution[];
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await apiClient.get('/dashboard/stats');
                setStats(data);
            } catch (error) {
                console.error("Falha ao buscar estatísticas do dashboard", error);
            }
        };

        fetchStats();
        // Poll every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) return <div>Carregando dashboard...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Visão Geral do Dashboard</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Laboratórios</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_labs}</div>
                        <p className="text-xs text-muted-foreground">Laboratórios registrados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Computadores</CardTitle>
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_computers}</div>
                        <p className="text-xs text-muted-foreground">Em todos os laboratórios</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Online Agora</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.online_computers}</div>
                        <p className="text-xs text-muted-foreground">Ativos nos últimos 5 min</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Softwares Únicos</CardTitle>
                        <Package className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{stats.total_softwares || 0}</div>
                        <p className="text-xs text-muted-foreground">Softwares detectados</p>
                    </CardContent>
                </Card>
            </div>

            {/* Hardware Averages */}
            {stats.hardware_averages && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Médias de Configuração (Todos os Laboratórios)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* CPU */}
                            {stats.hardware_averages.cpu && (
                                <div className="border-l-4 border-blue-500 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Cpu className="h-5 w-5 text-blue-500" />
                                        <h3 className="text-sm font-medium text-gray-700">CPU</h3>
                                    </div>
                                    <dl className="space-y-1">
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Núcleos Físicos (média):</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {stats.hardware_averages.cpu.avg_physical_cores?.toFixed(2) || 'N/A'}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Núcleos Lógicos (média):</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {stats.hardware_averages.cpu.avg_logical_cores?.toFixed(2) || 'N/A'}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            )}

                            {/* Memory */}
                            {stats.hardware_averages.memory && (
                                <div className="border-l-4 border-green-500 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MemoryStick className="h-5 w-5 text-green-500" />
                                        <h3 className="text-sm font-medium text-gray-700">Memória</h3>
                                    </div>
                                    <dl className="space-y-1">
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Total (média):</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {stats.hardware_averages.memory.avg_total_gb?.toFixed(2) || 'N/A'} GB
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            )}

                            {/* Disk */}
                            {stats.hardware_averages.disk && (
                                <div className="border-l-4 border-purple-500 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <HardDrive className="h-5 w-5 text-purple-500" />
                                        <h3 className="text-sm font-medium text-gray-700">Armazenamento</h3>
                                    </div>
                                    <dl className="space-y-1">
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Total (média):</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {stats.hardware_averages.disk.avg_total_gb?.toFixed(2) || 'N/A'} GB
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Usado (média):</dt>
                                            <dd className="text-sm text-gray-900">
                                                {stats.hardware_averages.disk.avg_used_gb?.toFixed(2) || 'N/A'} GB
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Uso médio:</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {stats.hardware_averages.disk.avg_usage_percent?.toFixed(1) || 'N/A'}%
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            )}
                        </div>
                        {stats.hardware_averages.computers_with_hardware_info && (
                            <p className="text-xs text-gray-500 mt-4">
                                Baseado em {stats.hardware_averages.computers_with_hardware_info} computador(es) com informações de hardware
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* OS Distribution */}
            {stats.os_distribution && stats.os_distribution.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Distribuição de Sistemas Operacionais</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stats.os_distribution.map((os, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-gray-900">{os.system}</h3>
                                        <Server className="h-4 w-4 text-gray-500" />
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">Versão: {os.release}</p>
                                    <p className="text-sm font-medium text-blue-600">{os.count} computador(es)</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
