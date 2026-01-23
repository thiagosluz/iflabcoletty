import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Search, Package, Cpu, MemoryStick, HardDrive, Monitor as MonitorIcon } from 'lucide-react';

interface HardwareInfo {
    cpu?: {
        physical_cores?: number;
        logical_cores?: number;
        processor?: string;
    };
    memory?: {
        total_gb?: number;
        available_gb?: number;
    };
    disk?: {
        total_gb?: number;
        used_gb?: number;
        free_gb?: number;
    };
    os?: {
        system?: string;
        release?: string;
        version?: string;
    };
}

interface Software {
    id: number;
    name: string;
    version: string | null;
    vendor: string | null;
    pivot?: {
        installed_at: string;
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

interface PublicComputerData {
    hostname: string | null;
    lab: {
        name: string;
    };
    hardware_info: HardwareInfo | null;
    status: 'online' | 'offline';
    last_seen: string;
}

export default function PublicComputerView() {
    const { hash } = useParams<{ hash: string }>();
    const [computer, setComputer] = useState<PublicComputerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [softwares, setSoftwares] = useState<Software[]>([]);
    const [softwareSearch, setSoftwareSearch] = useState('');
    const [loadingSoftwares, setLoadingSoftwares] = useState(false);
    const [softwarePagination, setSoftwarePagination] = useState<PaginationMeta | null>(null);

    useEffect(() => {
        if (hash) {
            fetchComputer();
        }
    }, [hash]);

    useEffect(() => {
        if (hash) {
            // Debounce search to avoid too many requests
            const timeoutId = setTimeout(() => {
                fetchSoftwares();
            }, 500); // Wait 500ms after user stops typing

            return () => clearTimeout(timeoutId);
        }
    }, [hash, softwareSearch]);

    const fetchComputer = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`/api/v1/public/computers/${hash}`);
            setComputer(response.data);
        } catch (err: any) {
            if (err.response?.status === 404) {
                setError('Computador não encontrado. O link pode estar inválido ou expirado.');
            } else {
                setError('Erro ao carregar informações do computador. Tente novamente mais tarde.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchSoftwares = async () => {
        if (!hash) return;
        
        try {
            setLoadingSoftwares(true);
            const params = new URLSearchParams();
            params.append('per_page', '100'); // Get more items for public view
            if (softwareSearch) {
                params.append('search', softwareSearch);
            }

            const response = await axios.get(`/api/v1/public/computers/${hash}/softwares?${params.toString()}`);
            setSoftwares(response.data.data || []);
            setSoftwarePagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || 100,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (err) {
            console.error('Erro ao buscar softwares:', err);
        } finally {
            setLoadingSoftwares(false);
        }
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando informações...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro</h1>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    if (!computer) {
        return null;
    }

    const isOnline = computer.status === 'online';

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {computer.hostname || 'Computador'}
                            </h1>
                            <p className="text-gray-600">{computer.lab.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`h-4 w-4 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className={`font-semibold ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                        Última atualização: {new Date(computer.last_seen).toLocaleString('pt-BR')}
                    </div>
                </div>

                {/* Hardware Information */}
                {computer.hardware_info && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Informações de Hardware</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* CPU */}
                            {computer.hardware_info.cpu && (
                                <div className="border-l-4 border-blue-500 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Cpu className="h-5 w-5 text-blue-500" />
                                        <h3 className="text-sm font-medium text-gray-700">CPU</h3>
                                    </div>
                                    <dl className="space-y-1">
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Processador:</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {computer.hardware_info.cpu.processor || 'N/A'}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Núcleos Físicos:</dt>
                                            <dd className="text-sm text-gray-900">
                                                {computer.hardware_info.cpu.physical_cores || 'N/A'}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Núcleos Lógicos:</dt>
                                            <dd className="text-sm text-gray-900">
                                                {computer.hardware_info.cpu.logical_cores || 'N/A'}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            )}

                            {/* Memory */}
                            {computer.hardware_info.memory && (
                                <div className="border-l-4 border-green-500 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MemoryStick className="h-5 w-5 text-green-500" />
                                        <h3 className="text-sm font-medium text-gray-700">Memória</h3>
                                    </div>
                                    <dl className="space-y-1">
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Total:</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {computer.hardware_info.memory.total_gb || 'N/A'} GB
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Disponível:</dt>
                                            <dd className="text-sm text-gray-900">
                                                {computer.hardware_info.memory.available_gb || 'N/A'} GB
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            )}

                            {/* Disk */}
                            {computer.hardware_info.disk && (
                                <div className="border-l-4 border-purple-500 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <HardDrive className="h-5 w-5 text-purple-500" />
                                        <h3 className="text-sm font-medium text-gray-700">Armazenamento</h3>
                                    </div>
                                    <dl className="space-y-1">
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Total:</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {computer.hardware_info.disk.total_gb || 'N/A'} GB
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Usado:</dt>
                                            <dd className="text-sm text-gray-900">
                                                {computer.hardware_info.disk.used_gb || 'N/A'} GB
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Livre:</dt>
                                            <dd className="text-sm text-gray-900">
                                                {computer.hardware_info.disk.free_gb || 'N/A'} GB
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            )}

                            {/* OS */}
                            {computer.hardware_info.os && (
                                <div className="border-l-4 border-orange-500 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MonitorIcon className="h-5 w-5 text-orange-500" />
                                        <h3 className="text-sm font-medium text-gray-700">Sistema Operacional</h3>
                                    </div>
                                    <dl className="space-y-1">
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Sistema:</dt>
                                            <dd className="text-sm text-gray-900 font-medium">
                                                {computer.hardware_info.os.system || 'N/A'}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-sm text-gray-500">Versão:</dt>
                                            <dd className="text-sm text-gray-900">
                                                {computer.hardware_info.os.release || 'N/A'}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Installed Software */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="h-5 w-5 text-gray-700" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Software Instalado {softwarePagination && `(${softwarePagination.total})`}
                        </h2>
                    </div>

                    {/* Search */}
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, versão ou fabricante..."
                                value={softwareSearch}
                                onChange={(e) => setSoftwareSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {loadingSoftwares ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="text-gray-500">Carregando softwares...</div>
                        </div>
                    ) : softwares.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {softwares.map((software) => (
                                <div
                                    key={software.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                                            {software.name}
                                        </h3>
                                        <Package className="h-5 w-5 text-blue-500 flex-shrink-0 ml-2" />
                                    </div>
                                    
                                    {software.version && (
                                        <div className="mb-2">
                                            <span className="text-xs text-gray-500">Versão:</span>
                                            <span className="ml-2 text-sm font-medium text-gray-700">
                                                {software.version}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {software.vendor && (
                                        <div className="mb-2">
                                            <span className="text-xs text-gray-500">Fabricante:</span>
                                            <span className="ml-2 text-sm text-gray-700">
                                                {software.vendor}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {software.pivot?.installed_at && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <span className="text-xs text-gray-500">
                                                Instalado em: {new Date(software.pivot.installed_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">
                                {softwareSearch ? 'Nenhum software encontrado com sua busca' : 'Nenhum software instalado'}
                            </p>
                        </div>
                    )}

                    {softwarePagination && (
                        <div className="mt-4 text-sm text-gray-500 text-center">
                            {softwareSearch ? (
                                <>Mostrando {softwares.length} resultado(s) da busca</>
                            ) : (
                                <>Total: {softwarePagination.total} software(s) instalado(s)</>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-gray-500 mt-8">
                    <p>Informações públicas do computador - iFLab Coletty</p>
                </div>
            </div>
        </div>
    );
}
