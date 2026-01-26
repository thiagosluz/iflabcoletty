import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Activity, Server, Cpu, MemoryStick, HardDrive, Package } from 'lucide-react';
import echo from '@/lib/echo';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

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

interface HistoryPoint {
    hour: string;
    avg_cpu: number;
    avg_memory: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [statsRes, historyRes] = await Promise.all([
                apiClient.get('/dashboard/stats'),
                apiClient.get('/dashboard/history')
            ]);
            setStats(statsRes.data);
            setHistory(historyRes.data.map((h: any) => ({
                ...h,
                avg_cpu: parseFloat(h.avg_cpu),
                avg_memory: parseFloat(h.avg_memory),
                hour: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
        } catch (error) {
            console.error("Falha ao buscar dados do dashboard", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Listen for real-time updates via WebSocket
        const token = localStorage.getItem('token');
        if (token) {
            const dashboardChannel = echo.private('dashboard');
            
            dashboardChannel.listen('.computer.status.changed', () => fetchData());
            dashboardChannel.listen('.software.installed', () => fetchData());
            dashboardChannel.listen('.hardware.alert', () => fetchData());

            return () => {
                echo.leave('dashboard');
            };
        }
    }, []);

    if (loading || !stats) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-gray-500">Carregando dashboard...</div>
            </div>
        );
    }

    // Prepare data for Pie Chart (OS Distribution)
    const pieData = stats.os_distribution?.map(os => ({
        name: `${os.system} ${os.release}`,
        value: os.count
    })) || [];

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Visão Geral do Dashboard</h2>

            {/* Summary Cards */}
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

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Usage History Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Histórico de Uso (Média 24h)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full min-h-[300px]">
                            {history.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={history}
                                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="hour" />
                                        <YAxis />
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <Tooltip />
                                        <Area type="monotone" dataKey="avg_cpu" stroke="#8884d8" fillOpacity={1} fill="url(#colorCpu)" name="CPU (%)" />
                                        <Area type="monotone" dataKey="avg_memory" stroke="#82ca9d" fillOpacity={1} fill="url(#colorMem)" name="Memória (%)" />
                                        <Legend />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    Sem dados históricos suficientes
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* OS Distribution Pie Chart */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Distribuição de SO</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full min-h-[300px]">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    Sem dados de SO
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Hardware Stats */}
            {stats.hardware_averages && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Média CPU (Cores)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Físicos</span>
                                    <span className="font-bold">{stats.hardware_averages.cpu?.avg_physical_cores?.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Lógicos</span>
                                    <span className="font-bold">{stats.hardware_averages.cpu?.avg_logical_cores?.toFixed(1)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Média RAM</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center">
                                <span className="text-2xl font-bold">{stats.hardware_averages.memory?.avg_total_gb?.toFixed(1)} GB</span>
                                <MemoryStick className="h-4 w-4 text-green-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Média Disco</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total</span>
                                    <span className="font-bold">{stats.hardware_averages.disk?.avg_total_gb?.toFixed(0)} GB</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                        className="bg-purple-600 h-2.5 rounded-full" 
                                        style={{ width: `${stats.hardware_averages.disk?.avg_usage_percent || 0}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs text-right text-gray-500">
                                    {stats.hardware_averages.disk?.avg_usage_percent?.toFixed(1)}% Usado
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
