import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Search, Package, Cpu, MemoryStick, HardDrive, Monitor as MonitorIcon, Download } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

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
        description?: string | null;
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
    const [currentPage, setCurrentPage] = useState(1);
    const [sortBy, setSortBy] = useState<'name' | 'vendor' | 'installed_at'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        if (hash) {
            fetchComputer();
        }
    }, [hash]);

    useEffect(() => {
        if (hash) {
            // Reset to page 1 when search changes
            setCurrentPage(1);
        }
    }, [softwareSearch]);

    useEffect(() => {
        if (hash) {
            // Debounce search to avoid too many requests
            const timeoutId = setTimeout(() => {
                fetchSoftwares(currentPage);
            }, 500); // Wait 500ms after user stops typing or page changes

            return () => clearTimeout(timeoutId);
        }
    }, [hash, softwareSearch, currentPage]);

    const fetchComputer = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`/api/v1/public/computers/${hash}`);
            setComputer(response.data);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 404) {
                setError('Computador não encontrado. O link pode estar inválido ou expirado.');
            } else if (axios.isAxiosError(err) && err.response?.status === 410) {
                setError('Este link público expirou. Solicite um novo link ao administrador do sistema.');
            } else {
                setError('Erro ao carregar informações do computador. Tente novamente mais tarde.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchSoftwares = async (page = 1) => {
        if (!hash) return;

        try {
            setLoadingSoftwares(true);
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('per_page', '50'); // Reasonable page size
            if (softwareSearch) {
                params.append('search', softwareSearch);
            }
            params.append('sort_by', sortBy);
            params.append('sort_direction', sortDirection);

            const response = await axios.get(`/api/v1/public/computers/${hash}/softwares?${params.toString()}`);
            setSoftwares(response.data.data || []);
            setSoftwarePagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || 50,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (err: unknown) {
            console.error('Erro ao buscar softwares:', err);
        } finally {
            setLoadingSoftwares(false);
        }
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header Skeleton */}
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6 animate-pulse">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-32"></div>
                            </div>
                            <div className="h-8 w-24 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-48"></div>
                    </div>

                    {/* Hardware Skeleton */}
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6 animate-pulse">
                        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="border-l-4 border-gray-200 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-5 w-5 bg-gray-200 rounded"></div>
                                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Software Skeleton */}
                    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                        <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
                        <div className="h-10 bg-gray-200 rounded w-full mb-6"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
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
        const lastSeenDate = new Date(computer.last_seen);
        const isStale = Date.now() - lastSeenDate.getTime() > 24 * 60 * 60 * 1000;

        const handleExportSoftwares = async () => {
            if (!softwares.length) return;
            const lines = softwares.map((s) => {
                const parts = [s.name];
                if (s.version) parts.push(`v${s.version}`);
                if (s.vendor) parts.push(`by ${s.vendor}`);
                return parts.join(' - ');
            });
            const text = lines.join('\n');
            const ok = await copyToClipboard(text);
            if (ok) {
                alert('Lista de softwares copiada para a área de transferência.');
            } else {
                alert('Não foi possível copiar automaticamente. Você pode selecionar e copiar manualmente.\n\nConteúdo:\n' + text.slice(0, 500) + (text.length > 500 ? '...' : ''));
            }
        };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {computer.hostname || 'Computador'}
                            </h1>
                            <p className="text-gray-600">{computer.lab.name}</p>
                            {computer.lab.description && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {computer.lab.description}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`h-4 w-4 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className={`font-semibold ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500 space-y-1">
                        <div>
                            Última atualização: {lastSeenDate.toLocaleString('pt-BR')}
                        </div>
                        {isStale && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1 inline-block">
                                As informações podem estar desatualizadas (sem atualizações há mais de 24 horas).
                            </div>
                        )}
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
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-gray-700" />
                            <h2 className="text-xl font-semibold text-gray-900">
                                Software Instalado {softwarePagination && `(${softwarePagination.total})`}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportSoftwares}
                            disabled={!softwares.length}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="h-4 w-4" />
                            Exportar lista
                        </button>
                    </div>

                    {/* Search & Sort */}
                    <div className="mb-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                        <div className="flex-1">
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
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">Ordenar por:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
                            >
                                <option value="name">Nome</option>
                                <option value="vendor">Fabricante</option>
                                <option value="installed_at">Data de instalação</option>
                            </select>
                            <select
                                value={sortDirection}
                                onChange={(e) => setSortDirection(e.target.value as typeof sortDirection)}
                                className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
                            >
                                <option value="asc">Ascendente</option>
                                <option value="desc">Descendente</option>
                            </select>
                        </div>
                    </div>

                    {loadingSoftwares ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
                            ))}
                        </div>
                    ) : softwares.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

                            {/* Pagination Controls */}
                            {softwarePagination && softwarePagination.last_page > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-6">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={softwarePagination.current_page === 1}
                                        className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Anterior
                                    </button>
                                    <span className="text-sm text-gray-700">
                                        Página {softwarePagination.current_page} de {softwarePagination.last_page}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, softwarePagination.last_page))}
                                        disabled={softwarePagination.current_page === softwarePagination.last_page}
                                        className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            )}
                        </>
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
