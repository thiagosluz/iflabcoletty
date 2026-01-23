import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Copy, Download, QrCode, ChevronLeft, ChevronRight, Search, Package, Cpu, MemoryStick, HardDrive, Monitor as MonitorIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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

interface Activity {
    id: number;
    type: string;
    description: string;
    payload: any;
    created_at: string;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface Computer {
    id: number;
    machine_id: string;
    public_hash: string;
    hostname: string | null;
    hardware_info: HardwareInfo | null;
    lab: {
        id: number;
        name: string;
    };
    activities: Activity[];
    created_at: string;
    updated_at: string;
}

export default function ComputerDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [computer, setComputer] = useState<Computer | null>(null);
    const [loading, setLoading] = useState(true);
    const [softwares, setSoftwares] = useState<Software[]>([]);
    const [softwareSearch, setSoftwareSearch] = useState('');
    const [softwareCurrentPage, setSoftwareCurrentPage] = useState(1);
    const [softwarePerPage, setSoftwarePerPage] = useState(20);
    const [softwarePagination, setSoftwarePagination] = useState<PaginationMeta | null>(null);
    const [loadingSoftwares, setLoadingSoftwares] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchComputer();
    }, [id]);

    useEffect(() => {
        if (computer) {
            fetchSoftwares();
        }
    }, [computer, softwareCurrentPage, softwarePerPage, softwareSearch]);

    const fetchComputer = async () => {
        try {
            const response = await apiClient.get(`/computers/${id}`);
            setComputer(response.data);
        } catch (error) {
            console.error('Falha ao buscar computador:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSoftwares = async () => {
        if (!id) return;
        
        try {
            setLoadingSoftwares(true);
            const params = new URLSearchParams();
            params.append('page', softwareCurrentPage.toString());
            params.append('per_page', softwarePerPage.toString());
            if (softwareSearch) {
                params.append('search', softwareSearch);
            }

            const response = await apiClient.get(`/computers/${id}/softwares?${params.toString()}`);
            setSoftwares(response.data.data || []);
            setSoftwarePagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || softwarePerPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error) {
            console.error('Falha ao buscar softwares:', error);
        } finally {
            setLoadingSoftwares(false);
        }
    };

    const handleSoftwareSearchChange = (value: string) => {
        setSoftwareSearch(value);
        setSoftwareCurrentPage(1); // Reset to first page on search
    };

    const handleSoftwarePerPageChange = (value: string) => {
        setSoftwarePerPage(parseInt(value));
        setSoftwareCurrentPage(1); // Reset to first page when changing per page
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Carregando...</div>
            </div>
        );
    }

    if (!computer) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-red-500">Computador não encontrado</div>
            </div>
        );
    }

    const isOnline = new Date().getTime() - new Date(computer.updated_at).getTime() < 5 * 60 * 1000;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate('/admin/computers')}
                        className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
                    >
                        ← Voltar para Computadores
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {computer.hostname || computer.machine_id}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span
                            className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                        />
                        <span className="text-sm text-gray-600">
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className="text-sm text-gray-500">
                            • Última atualização: {new Date(computer.updated_at).toLocaleString('pt-BR')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Informações Básicas</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <dt className="text-sm font-medium text-gray-500">ID da Máquina</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-mono">{computer.machine_id}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Hostname</dt>
                        <dd className="mt-1 text-sm text-gray-900">{computer.hostname || 'N/A'}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Laboratório</dt>
                        <dd className="mt-1 text-sm text-gray-900">{computer.lab.name}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Registrado em</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                            {new Date(computer.created_at).toLocaleString('pt-BR')}
                        </dd>
                    </div>
                </dl>
            </div>

            {/* QR Code Section */}
            {computer.public_hash && (
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <QrCode className="h-5 w-5 text-gray-700" />
                        <h2 className="text-lg font-semibold">QR Code e Link Público</h2>
                    </div>
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="flex-1">
                            <QRCodeDisplay
                                value={`${window.location.origin}/public/pc/${computer.public_hash}`}
                                size={200}
                                title="QR Code para Acesso Público"
                            />
                        </div>
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Link Público
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={`${window.location.origin}/public/pc/${computer.public_hash}`}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            const publicUrl = `${window.location.origin}/public/pc/${computer.public_hash}`;
                                            try {
                                                await navigator.clipboard.writeText(publicUrl);
                                                toast({
                                                    title: 'Link copiado!',
                                                    description: 'O link público foi copiado para a área de transferência.',
                                                });
                                            } catch (err) {
                                                toast({
                                                    title: 'Erro',
                                                    description: 'Não foi possível copiar o link.',
                                                    variant: 'destructive',
                                                });
                                            }
                                        }}
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copiar
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Baixar QR Code
                                </label>
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        try {
                                            const response = await apiClient.get(
                                                `/computers/${computer.id}/qrcode`,
                                                { responseType: 'blob' }
                                            );
                                            const url = window.URL.createObjectURL(new Blob([response.data]));
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', `qrcode-${computer.hostname || computer.machine_id}.png`);
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                            window.URL.revokeObjectURL(url);
                                            toast({
                                                title: 'Download iniciado!',
                                                description: 'O QR code foi baixado com sucesso.',
                                            });
                                        } catch (error) {
                                            toast({
                                                title: 'Erro',
                                                description: 'Não foi possível baixar o QR code.',
                                                variant: 'destructive',
                                            });
                                        }
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Baixar QR Code (PNG)
                                </Button>
                            </div>
                            <div className="text-sm text-gray-500">
                                <p>O QR code permite acesso público às informações básicas deste computador sem necessidade de autenticação.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hardware Info */}
            {computer.hardware_info && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Informações de Hardware</h2>
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
                                        <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.cpu.processor || 'N/A'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Núcleos Físicos:</dt>
                                        <dd className="text-sm text-gray-900">{computer.hardware_info.cpu.physical_cores || 'N/A'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Núcleos Lógicos:</dt>
                                        <dd className="text-sm text-gray-900">{computer.hardware_info.cpu.logical_cores || 'N/A'}</dd>
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
                                        <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.memory.total_gb || 'N/A'} GB</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Disponível:</dt>
                                        <dd className="text-sm text-gray-900">{computer.hardware_info.memory.available_gb || 'N/A'} GB</dd>
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
                                        <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.disk.total_gb || 'N/A'} GB</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Usado:</dt>
                                        <dd className="text-sm text-gray-900">{computer.hardware_info.disk.used_gb || 'N/A'} GB</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Livre:</dt>
                                        <dd className="text-sm text-gray-900">{computer.hardware_info.disk.free_gb || 'N/A'} GB</dd>
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
                                        <dd className="text-sm text-gray-900 font-medium">{computer.hardware_info.os.system || 'N/A'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-sm text-gray-500">Versão:</dt>
                                        <dd className="text-sm text-gray-900">{computer.hardware_info.os.release || 'N/A'}</dd>
                                    </div>
                                </dl>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Installed Software */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-gray-700" />
                    <h2 className="text-lg font-semibold">
                        Software Instalado {softwarePagination && `(${softwarePagination.total})`}
                    </h2>
                </div>

                {/* Search and Per Page */}
                <div className="flex gap-4 items-center mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            placeholder="Buscar por nome, versão ou fabricante..."
                            className="pl-10"
                            value={softwareSearch}
                            onChange={(e) => handleSoftwareSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                        <Select value={softwarePerPage.toString()} onValueChange={handleSoftwarePerPageChange}>
                            <SelectTrigger className="w-[100px]">
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

                {loadingSoftwares ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="text-gray-500">Carregando softwares...</div>
                    </div>
                ) : softwares.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {softwares.map((software) => (
                                <div
                                    key={software.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
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

                        {/* Pagination */}
                        {softwarePagination && softwarePagination.last_page > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Mostrando {softwarePagination.from} a {softwarePagination.to} de {softwarePagination.total} softwares
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSoftwareCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={softwareCurrentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Anterior
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, softwarePagination.last_page) }, (_, i) => {
                                            let pageNum;
                                            if (softwarePagination.last_page <= 5) {
                                                pageNum = i + 1;
                                            } else if (softwareCurrentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (softwareCurrentPage >= softwarePagination.last_page - 2) {
                                                pageNum = softwarePagination.last_page - 4 + i;
                                            } else {
                                                pageNum = softwareCurrentPage - 2 + i;
                                            }
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={softwareCurrentPage === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setSoftwareCurrentPage(pageNum)}
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
                                        onClick={() => setSoftwareCurrentPage(prev => Math.min(softwarePagination.last_page, prev + 1))}
                                        disabled={softwareCurrentPage === softwarePagination.last_page}
                                    >
                                        Próxima
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Info when no pagination needed */}
                        {softwarePagination && softwarePagination.last_page === 1 && (
                            <div className="mt-4 text-sm text-gray-500">
                                Mostrando {softwarePagination.total} {softwarePagination.total === 1 ? 'software' : 'softwares'}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12">
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                            {softwareSearch ? 'Nenhum software encontrado com sua busca' : 'Nenhuma informação de software disponível'}
                        </p>
                    </div>
                )}
            </div>

            {/* Activity History */}
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">
                    Histórico de Atividades ({computer.activities.length})
                </h2>
                {computer.activities.length > 0 ? (
                    <div className="space-y-3">
                        {computer.activities.map((activity) => (
                            <div key={activity.id} className="border-l-4 border-blue-500 pl-4 py-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                                        <p className="text-xs text-gray-500 mt-1">Tipo: {activity.type}</p>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(activity.created_at).toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm">Nenhum histórico de atividades disponível</p>
                )}
            </div>
        </div>
    );
}
