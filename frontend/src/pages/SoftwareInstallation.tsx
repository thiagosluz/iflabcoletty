import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import SoftwareInstallationService, { SoftwareInstallation, CreateInstallationRequest } from '@/services/SoftwareInstallationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, Link, Network, Package, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
    const [installations, setInstallations] = useState<SoftwareInstallation[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        fetchLabs();
        fetchInstallations();
        fetchComputers(); // Initial load
    }, []);

    useEffect(() => {
        // Debounce search to avoid too many requests
        const timeoutId = setTimeout(() => {
            fetchComputers();
        }, searchTerm ? 500 : 0);

        return () => clearTimeout(timeoutId);
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
            toast({
                title: 'Erro ao buscar computadores',
                description: 'Não foi possível carregar a lista de computadores',
                variant: 'destructive',
            });
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

    const fetchInstallations = async () => {
        try {
            const response = await SoftwareInstallationService.getInstallations({ per_page: 50 });
            setInstallations(response.data);
        } catch (error) {
            console.error('Error fetching installations:', error);
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
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Erro ao enviar arquivo',
                description: err.response?.data?.message || 'Erro desconhecido',
                variant: 'destructive',
            });
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
            
            // Refresh installations
            fetchInstallations();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Erro ao iniciar instalação',
                description: err.response?.data?.message || 'Erro desconhecido',
                variant: 'destructive',
            });
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
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Histórico de Instalações</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Software</TableHead>
                                    <TableHead>Computador</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Data</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {installations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                                            Nenhuma instalação encontrada
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    installations.map(installation => (
                                        <TableRow key={installation.id}>
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
                                            <TableCell>
                                                {new Date(installation.created_at).toLocaleString('pt-BR')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
