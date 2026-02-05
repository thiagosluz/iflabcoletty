import { useState, useEffect, useCallback, Fragment } from 'react';
import apiClient from '@/lib/axios';
import SoftwareInstallationService, { type SoftwareInstallation as SoftwareInstallationModel, CreateInstallationRequest } from '@/services/SoftwareInstallationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, Link, Network, Package, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Computer {
    id: number;
    hostname: string;
    machine_id: string;
    lab?: {
        id: number;
        name: string;
    };
    hardware_info?: {
        os?: {
            system?: string;
        };
    };
}

interface Lab {
    id: number;
    name: string;
}

export default function SoftwareInstallation() {
    const { toast } = useToast();
    const [computers, setComputers] = useState<Computer[]>([]);
    const [labs, setLabs] = useState<Lab[]>([]);
    const [selectedComputers, setSelectedComputers] = useState<number[]>([]);
    const [labFilter, setLabFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [method, setMethod] = useState<'upload' | 'url' | 'network'>('upload');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [fileId, setFileId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [softwareName, setSoftwareName] = useState('');
    const [installArgs, setInstallArgs] = useState('');
    const [silentMode, setSilentMode] = useState(true);
    const [rebootAfter, setRebootAfter] = useState(false);
    const [installerUrl, setInstallerUrl] = useState('');
    const [networkPath, setNetworkPath] = useState('');
    const [installations, setInstallations] = useState<SoftwareInstallationModel[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedOutputId, setExpandedOutputId] = useState<number | null>(null);
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPerPage, setHistoryPerPage] = useState(20);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyLastPage, setHistoryLastPage] = useState(1);
    const [installationToDelete, setInstallationToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchLabs();
        fetchInstallations();
        fetchComputers();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; fetches defined below
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => fetchComputers(), searchTerm ? 500 : 0);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced by design
    }, [labFilter, searchTerm]);

    const fetchComputers = async () => {
        try {
            const params: Record<string, string> = {
                per_page: '1000',
            };
            if (labFilter !== 'all') {
                params.lab_id = labFilter;
            }
            if (searchTerm) {
                params.search = searchTerm;
            }

            const response = await apiClient.get('/computers', { params });
            // Handle paginated response - Laravel returns { data: [...], current_page, etc }
            const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);

            // Filter only Windows computers
            const windowsComputers = data.filter((computer: Computer) => {
                // Check if hardware_info exists and has os information
                if (!computer.hardware_info) {
                    return false;
                }

                // Handle both object and parsed JSON cases
                let hardwareInfo = computer.hardware_info;
                if (typeof hardwareInfo === 'string') {
                    try {
                        hardwareInfo = JSON.parse(hardwareInfo);
                    } catch {
                        return false;
                    }
                }

                const osSystem = hardwareInfo?.os?.system;
                return osSystem === 'Windows';
            });

            setComputers(windowsComputers);
        } catch (error) {
            console.error('Error fetching computers:', error);
            toast({ ...getApiErrorToast(error) });
        }
    };

    const fetchLabs = async () => {
        try {
            const response = await apiClient.get('/labs?per_page=1000');
            setLabs(response.data.data || response.data || []);
        } catch (error) {
            console.error('Error fetching labs:', error);
        }
    };

    const fetchInstallations = useCallback(async (page = historyPage, perPage = historyPerPage, search = historySearch) => {
        try {
            const params: { per_page?: number; search?: string; page?: number } = { per_page: perPage };
            if (search) params.search = search;
            if (page > 1) params.page = page;

            const response = await SoftwareInstallationService.getInstallations(params);
            const list = response.data;
            setInstallations(list);
            setHistoryTotal(response.total || list.length);
            setHistoryLastPage(response.last_page || 1);
            setHistoryPage(response.current_page || 1);
        } catch (error) {
            console.error('Error fetching installations:', error);
        }
    }, [historyPage, historyPerPage, historySearch]);

    // Poll for status updates when there are pending or processing installations
    const hasActiveInstallations = installations.some(
        (i) => i.status === 'pending' || i.status === 'processing'
    );
    useEffect(() => {
        if (!hasActiveInstallations || !showHistory) return;
        const interval = setInterval(() => fetchInstallations(historyPage, historyPerPage, historySearch), 3000);
        return () => clearInterval(interval);
    }, [hasActiveInstallations, showHistory, historyPage, historyPerPage, historySearch, fetchInstallations]);

    // Fetch installations when modal opens
    useEffect(() => {
        if (showHistory) {
            setHistoryPage(1);
            setHistorySearch('');
            fetchInstallations(1, historyPerPage, '');
        }
    }, [showHistory, historyPerPage, fetchInstallations]);

    const handleHistorySearch = useCallback(() => {
        setHistoryPage(1);
        fetchInstallations(1, historyPerPage, historySearch);
    }, [historySearch, historyPerPage, fetchInstallations]);

    const handleDeleteInstallation = async (id: number) => {
        setIsDeleting(true);
        try {
            await SoftwareInstallationService.deleteInstallation(id);
            toast({
                title: 'Instalação excluída',
                description: 'A instalação foi excluída com sucesso',
            });
            fetchInstallations(historyPage, historyPerPage, historySearch);
            setInstallationToDelete(null);
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        try {
            const response = await SoftwareInstallationService.uploadInstaller(file);
            setFileId(response.file_id);
            setUploadedFile(file);
            toast({
                title: 'Arquivo enviado',
                description: `Arquivo ${file.name} enviado com sucesso`,
            });
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setUploading(false);
        }
    };

    const handleInstall = async () => {
        if (selectedComputers.length === 0) {
            toast({
                title: 'Nenhum computador selecionado',
                description: 'Selecione pelo menos um computador Windows',
                variant: 'destructive',
            });
            return;
        }

        if (method === 'upload' && !fileId) {
            toast({
                title: 'Arquivo não enviado',
                description: 'Faça upload do instalador primeiro',
                variant: 'destructive',
            });
            return;
        }

        if (method === 'url' && !installerUrl) {
            toast({
                title: 'URL não informada',
                description: 'Informe a URL do instalador',
                variant: 'destructive',
            });
            return;
        }

        if (method === 'network' && !networkPath) {
            toast({
                title: 'Caminho de rede não informado',
                description: 'Informe o caminho de rede do instalador',
                variant: 'destructive',
            });
            return;
        }

        setInstalling(true);
        try {
            const data: CreateInstallationRequest = {
                computer_ids: selectedComputers,
                method,
                software_name: softwareName || undefined,
                install_args: installArgs || undefined,
                silent_mode: silentMode,
                reboot_after: rebootAfter,
            };

            if (method === 'upload') {
                data.file_id = fileId!;
            } else if (method === 'url') {
                data.installer_url = installerUrl;
            } else if (method === 'network') {
                data.network_path = networkPath;
            }

            const response = await SoftwareInstallationService.createInstallation(data);
            toast({
                title: 'Instalação iniciada',
                description: response.message,
            });

            // Reset form
            setSelectedComputers([]);
            setFileId(null);
            setUploadedFile(null);
            setInstallerUrl('');
            setNetworkPath('');
            setSoftwareName('');
            setInstallArgs('');

            // Refresh installations if history modal is open
            if (showHistory) {
                fetchInstallations(historyPage, historyPerPage, historySearch);
            }
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setInstalling(false);
        }
    };

    const toggleComputer = (computerId: number) => {
        setSelectedComputers(prev =>
            prev.includes(computerId)
                ? prev.filter(id => id !== computerId)
                : [...prev, computerId]
        );
    };

    const toggleAllComputers = () => {
        if (selectedComputers.length === filteredComputers.length) {
            setSelectedComputers([]);
        } else {
            setSelectedComputers(filteredComputers.map(c => c.id));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>;
            case 'failed':
                return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
            case 'processing':
                return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando</Badge>;
            default:
                return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
        }
    };

    const getProgressMessage = (installation: SoftwareInstallationModel): string => {
        if (installation.status === 'pending') return 'Aguardando agente...';
        const text = (installation.output || installation.error_message || '').trim();
        if (!text) return installation.status === 'processing' ? 'Em andamento...' : '';
        return text.length > 80 ? text.slice(0, 80) + '...' : text;
    };

    // No need for additional filtering - backend already handles search
    // Just use computers directly since they're already filtered by Windows and search
    const filteredComputers = computers;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Instalação de Programas</h1>
                    <p className="text-muted-foreground mt-1">
                        Instale programas remotamente em computadores Windows
                    </p>
                </div>
                <Button onClick={() => setShowHistory(true)} variant="outline">
                    Histórico
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Computer Selection */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Selecionar Computadores</CardTitle>
                        <CardDescription>
                            {computers.length} computador(es) Windows encontrado(s)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Filtrar por Laboratório</Label>
                            <Select value={labFilter} onValueChange={setLabFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos os laboratórios" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os laboratórios</SelectItem>
                                    {labs.map(lab => (
                                        <SelectItem key={lab.id} value={lab.id.toString()}>
                                            {lab.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Buscar</Label>
                            <Input
                                placeholder="Buscar por hostname ou ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        fetchComputers();
                                    }
                                }}
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSearchTerm('');
                                        fetchComputers();
                                    }}
                                    className="h-6 text-xs"
                                >
                                    Limpar busca
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {selectedComputers.length} selecionado(s)
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleAllComputers}
                            >
                                {selectedComputers.length === filteredComputers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </Button>
                        </div>

                        <div className="border rounded-md max-h-96 overflow-y-auto">
                            {filteredComputers.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    {searchTerm
                                        ? `Nenhum computador Windows encontrado para "${searchTerm}"`
                                        : 'Nenhum computador Windows encontrado'}
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {filteredComputers.map(computer => (
                                        <div
                                            key={computer.id}
                                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => toggleComputer(computer.id)}
                                        >
                                            <Checkbox
                                                checked={selectedComputers.includes(computer.id)}
                                                onCheckedChange={() => toggleComputer(computer.id)}
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium">{computer.hostname || 'Sem hostname'}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {computer.lab?.name} • {computer.machine_id}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Installation Configuration */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Configuração de Instalação</CardTitle>
                        <CardDescription>
                            Escolha o método de instalação e configure os parâmetros
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={method} onValueChange={(v) => setMethod(v as 'upload' | 'url' | 'network')}>
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="upload">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload
                                </TabsTrigger>
                                <TabsTrigger value="url">
                                    <Link className="h-4 w-4 mr-2" />
                                    URL
                                </TabsTrigger>
                                <TabsTrigger value="network">
                                    <Network className="h-4 w-4 mr-2" />
                                    Rede
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="upload" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Arquivo Instalador</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept=".exe,.msi,.zip"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    handleFileUpload(file);
                                                }
                                            }}
                                            disabled={uploading}
                                        />
                                    </div>
                                    {uploadedFile && (
                                        <div className="flex items-center gap-2 text-sm text-green-600">
                                            <CheckCircle2 className="h-4 w-4" />
                                            {uploadedFile.name} ({Math.round(uploadedFile.size / 1024 / 1024)} MB)
                                        </div>
                                    )}
                                    {uploading && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Enviando arquivo...
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Formatos suportados: .exe, .msi, .zip (máx. 500MB)
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="url" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>URL do Instalador</Label>
                                    <Input
                                        placeholder="https://example.com/installer.exe"
                                        value={installerUrl}
                                        onChange={(e) => setInstallerUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        URL direta para download do instalador
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="network" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Caminho de Rede</Label>
                                    <Input
                                        placeholder="\\\\server\\share\\installer.exe"
                                        value={networkPath}
                                        onChange={(e) => setNetworkPath(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Caminho UNC para o arquivo na rede compartilhada
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="space-y-4 mt-6">
                            <div className="space-y-2">
                                <Label>Nome do Software (opcional)</Label>
                                <Input
                                    placeholder="Ex: Microsoft Office 2021"
                                    value={softwareName}
                                    onChange={(e) => setSoftwareName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Argumentos de Instalação (opcional)</Label>
                                <Input
                                    placeholder="Ex: /S /quiet /norestart"
                                    value={installArgs}
                                    onChange={(e) => setInstallArgs(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Argumentos adicionais para o instalador
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="silent"
                                        checked={silentMode}
                                        onCheckedChange={(checked) => setSilentMode(checked === true)}
                                    />
                                    <Label htmlFor="silent" className="cursor-pointer">
                                        Instalação silenciosa (sem interface gráfica)
                                    </Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="reboot"
                                        checked={rebootAfter}
                                        onCheckedChange={(checked) => setRebootAfter(checked === true)}
                                    />
                                    <Label htmlFor="reboot" className="cursor-pointer">
                                        Reiniciar após instalação
                                    </Label>
                                </div>
                            </div>

                            <Button
                                onClick={handleInstall}
                                disabled={installing || selectedComputers.length === 0}
                                className="w-full"
                            >
                                {installing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Instalando...
                                    </>
                                ) : (
                                    <>
                                        <Package className="h-4 w-4 mr-2" />
                                        Instalar em {selectedComputers.length} Computador(es)
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* History Dialog */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Histórico de Instalações</DialogTitle>
                        <CardDescription>
                            {hasActiveInstallations && (
                                <span className="flex items-center gap-2 text-blue-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Atualizando a cada 3 segundos enquanto houver instalações em andamento.
                                </span>
                            )}
                        </CardDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                        {/* Search and Per Page Controls */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Pesquisar por software, computador ou método..."
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleHistorySearch();
                                        }
                                    }}
                                />
                            </div>
                            <Button onClick={handleHistorySearch} variant="outline" size="sm">
                                Buscar
                            </Button>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="per-page" className="text-sm whitespace-nowrap">Por página:</Label>
                                <Select value={historyPerPage.toString()} onValueChange={(v) => {
                                    setHistoryPerPage(parseInt(v));
                                    setHistoryPage(1);
                                }}>
                                    <SelectTrigger id="per-page" className="w-20">
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

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Software</TableHead>
                                    <TableHead>Computador</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Progresso</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="w-20">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {installations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                                            {historySearch ? 'Nenhuma instalação encontrada para a pesquisa' : 'Nenhuma instalação encontrada'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    installations.map(installation => (
                                        <Fragment key={installation.id}>
                                            <TableRow>
                                                <TableCell>
                                                    {installation.software_name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {installation.computer?.hostname || installation.computer?.machine_id}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {installation.installer_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(installation.status)}
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    {installation.status === 'processing' && (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Progress value={50} className="h-1.5 flex-1" />
                                                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-muted-foreground block truncate" title={installation.output || installation.error_message || undefined}>
                                                        {getProgressMessage(installation)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(installation.created_at).toLocaleString('pt-BR')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {(installation.output || installation.error_message) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => setExpandedOutputId(expandedOutputId === installation.id ? null : installation.id)}
                                                            >
                                                                {expandedOutputId === installation.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => setInstallationToDelete(installation.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {expandedOutputId === installation.id && (installation.output || installation.error_message) && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="bg-muted/50 py-3">
                                                        <pre className="text-xs whitespace-pre-wrap break-words font-sans max-h-40 overflow-y-auto">
                                                            {installation.output || installation.error_message}
                                                        </pre>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        {historyTotal > 0 && (
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Mostrando {((historyPage - 1) * historyPerPage) + 1} a {Math.min(historyPage * historyPerPage, historyTotal)} de {historyTotal} instalações
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchInstallations(historyPage - 1, historyPerPage, historySearch)}
                                        disabled={historyPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Anterior
                                    </Button>
                                    <span className="text-sm">
                                        Página {historyPage} de {historyLastPage}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchInstallations(historyPage + 1, historyPerPage, historySearch)}
                                        disabled={historyPage >= historyLastPage}
                                    >
                                        Próxima
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={installationToDelete !== null} onOpenChange={(open) => !open && setInstallationToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir instalação?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O registro desta instalação será permanentemente removido do histórico.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => installationToDelete && handleDeleteInstallation(installationToDelete)}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Excluindo...
                                </>
                            ) : (
                                'Excluir'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
