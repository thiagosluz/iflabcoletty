import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Search, Package, Download } from 'lucide-react';
import ExportDialog from '@/components/ExportDialog';
import { useToast } from '@/components/ui/use-toast';

interface Software {
    id: number;
    name: string;
    version: string | null;
    vendor: string | null;
    computers_count?: number;
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

export default function Softwares() {
    const [softwares, setSoftwares] = useState<Software[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);

    useEffect(() => {
        fetchSoftwares();
    }, [currentPage, perPage, searchTerm]);

    const fetchSoftwares = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());
            if (searchTerm) {
                params.append('search', searchTerm);
            }

            const response = await apiClient.get(`/softwares?${params.toString()}`);
            setSoftwares(response.data.data || []);
            setPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || perPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error) {
            console.error('Falha ao buscar softwares:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1); // Reset to first page on search
    };

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing per page
    };

    const handleExport = async (format: 'pdf' | 'csv' | 'xlsx') => {
        try {
            const params: any = {
                format,
            };

            // Apply current filters
            if (searchTerm) {
                params.search = searchTerm;
            }

            const response = await apiClient.post('/reports/softwares', params, {
                responseType: 'blob',
            });

            // Check if response is actually an error JSON
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const errorData = JSON.parse(text);
                throw new Error(errorData.message || 'Erro ao exportar softwares');
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = format;
            link.setAttribute('download', `softwares-${new Date().toISOString().slice(0, 10)}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            let errorMessage = 'Falha ao exportar softwares';
            
            if (error.response) {
                const contentType = error.response.headers?.['content-type'] || '';
                if (contentType.includes('application/json')) {
                    errorMessage = error.response.data?.message || errorMessage;
                } else if (error.response.data instanceof Blob) {
                    try {
                        const text = await error.response.data.text();
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        errorMessage = error.response.statusText || errorMessage;
                    }
                } else {
                    errorMessage = error.response.data?.message || error.response.statusText || errorMessage;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Inventário de Software</h1>
                <ExportDialog
                    trigger={
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" /> Exportar
                        </Button>
                    }
                    onExport={handleExport}
                    title="Exportar Relatório de Softwares"
                    description="Escolha o formato para exportar a lista de softwares com os filtros aplicados"
                />
            </div>

            {/* Search and Per Page */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex gap-4 items-center mb-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, versão ou fabricante..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                        <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
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
            </div>

            {/* Software Cards */}
            {loading && softwares.length === 0 ? (
                <div className="bg-white shadow rounded-lg p-12">
                    <div className="flex justify-center items-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <div className="text-gray-500">Carregando softwares...</div>
                        </div>
                    </div>
                </div>
            ) : softwares.length > 0 ? (
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="h-5 w-5 text-gray-700" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            {pagination && `Total: ${pagination.total} software(s)`}
                        </h2>
                    </div>
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

                                {software.computers_count !== undefined && (
                                    <div className="mb-2">
                                        <span className="text-xs text-gray-500">Computadores:</span>
                                        <span className="ml-2 text-sm font-medium text-blue-600">
                                            {software.computers_count}
                                        </span>
                                    </div>
                                )}
                                
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <span className="text-xs text-gray-500">
                                        Primeira detecção: {new Date(software.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white shadow rounded-lg p-12">
                    <div className="text-center">
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                            {searchTerm ? 'Nenhum software encontrado com sua busca' : 'Nenhum software detectado ainda'}
                        </p>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.last_page > 1 && (
                <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                            Mostrando {pagination.from} a {pagination.to} de {pagination.total} softwares
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
                    Mostrando {pagination.total} {pagination.total === 1 ? 'software' : 'softwares'}
                </div>
            )}
        </div>
    );
}
