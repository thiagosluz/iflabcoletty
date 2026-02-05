import { useEffect, useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Search, Package, Download, List, LayoutGrid } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ExportDialog from '@/components/ExportDialog';
import SoftwareComputersModal from '@/components/SoftwareComputersModal';

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
    const [computersModalSoftware, setComputersModalSoftware] = useState<{ id: number; name: string } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const fetchSoftwares = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());
            if (searchTerm) params.append('search', searchTerm);

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
    }, [currentPage, perPage, searchTerm]);

    useEffect(() => {
        fetchSoftwares();
    }, [fetchSoftwares]);

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1); // Reset to first page on search
    };

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page when changing per page
    };

    const handleExport = async (format: 'pdf' | 'csv' | 'xlsx', async = true) => {
        try {
            const params: Record<string, string | number | boolean> = {
                format,
                async,
            };

            // Apply current filters
            if (searchTerm) {
                params.search = searchTerm;
            }

            const response = await apiClient.post('/reports/softwares', params, async ? {
                responseType: 'json',
            } : {
                responseType: 'blob',
            });

            // If async, return early (user will be redirected to jobs page)
            if (async && response.status === 202) {
                return; // Job created, user will be redirected
            }

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
        } catch (error: unknown) {
            let errorMessage = 'Falha ao exportar softwares';

            if (error instanceof AxiosError && error.response) {
                const contentType = error.response.headers?.['content-type'] || '';
                if (typeof contentType === 'string' && contentType.includes('application/json')) {
                    // Start of handling JSON error response
                    const responseData = error.response.data;
                    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
                        errorMessage = String((responseData as { message: unknown }).message) || errorMessage;
                    }
                } else if (error.response.data instanceof Blob) {
                    try {
                        const text = await error.response.data.text();
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.message || errorMessage;
                    } catch {
                        errorMessage = error.response.statusText || errorMessage;
                    }
                } else {
                    // Fallback for other types of data
                    const responseData = error.response.data;
                    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
                        errorMessage = String((responseData as { message: unknown }).message) || errorMessage;
                    } else {
                        errorMessage = error.response.statusText || errorMessage;
                    }
                }
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Inventário de Software</h1>
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
                    <div className="flex items-center gap-1">
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'outline'}
                            size="icon"
                            onClick={() => setViewMode('list')}
                            title="Lista"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'default' : 'outline'}
                            size="icon"
                            onClick={() => setViewMode('grid')}
                            title="Grade"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                {loading && softwares.length === 0 ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <div className="text-gray-500">Carregando softwares...</div>
                        </div>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Versão</TableHead>
                                    <TableHead>Fabricante</TableHead>
                                    <TableHead>Computadores</TableHead>
                                    <TableHead>Primeira detecção</TableHead>
                                    <TableHead className="w-[140px]">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {softwares.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            {searchTerm ? 'Nenhum software encontrado com sua busca' : 'Nenhum software detectado ainda'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    softwares.map((software) => (
                                        <TableRow key={software.id}>
                                            <TableCell className="font-medium">{software.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{software.version ?? '-'}</TableCell>
                                            <TableCell className="text-muted-foreground">{software.vendor ?? '-'}</TableCell>
                                            <TableCell>
                                                {software.computers_count !== undefined ? (
                                                    <Button
                                                        variant="link"
                                                        className="h-auto p-0 text-sm font-medium text-blue-600"
                                                        onClick={() => setComputersModalSoftware({ id: software.id, name: software.name })}
                                                    >
                                                        {software.computers_count} — Ver computadores
                                                    </Button>
                                                ) : (
                                                    '-'
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(software.created_at).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setComputersModalSoftware({ id: software.id, name: software.name })}
                                                >
                                                    Ver computadores
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <>
                        {softwares.length > 0 ? (
                            <>
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
                                                    <span className="text-xs text-gray-500">Computadores: </span>
                                                    <Button
                                                        variant="link"
                                                        className="h-auto p-0 ml-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                                                        onClick={() => setComputersModalSoftware({ id: software.id, name: software.name })}
                                                    >
                                                        {software.computers_count} — Ver computadores
                                                    </Button>
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
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">
                                    {searchTerm ? 'Nenhum software encontrado com sua busca' : 'Nenhum software detectado ainda'}
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* Pagination */}
                {pagination && pagination.last_page > 1 && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
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
                )}

                {/* Info when no pagination needed */}
                {pagination && pagination.last_page === 1 && (
                    <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                        Mostrando {pagination.total} {pagination.total === 1 ? 'software' : 'softwares'}
                    </div>
                )}
            </div>

            <SoftwareComputersModal
                open={computersModalSoftware != null}
                onOpenChange={(open) => !open && setComputersModalSoftware(null)}
                softwareId={computersModalSoftware?.id ?? null}
                softwareName={computersModalSoftware?.name ?? ''}
            />
        </div>
    );
}
