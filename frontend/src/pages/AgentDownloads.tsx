import { useState, useEffect } from 'react';
import AgentDownloadService, { AgentFilesResponse, AgentPackage, AgentInstaller } from '@/services/AgentDownloadService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Download, RefreshCw, Loader2, Package, FileCode, Monitor, Server, CheckCircle2, XCircle, Info } from 'lucide-react';
import apiClient from '@/lib/axios';

export default function AgentDownloads() {
    const { toast } = useToast();
    const [files, setFiles] = useState<AgentFilesResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            setLoading(true);
            const data = await AgentDownloadService.listFiles();
            setFiles(data);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Erro ao carregar arquivos',
                description: err.response?.data?.message || 'Erro desconhecido',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (url: string, filename: string) => {
        try {
            // Use apiClient to download with proper authentication
            const response = await apiClient.get(url, {
                responseType: 'blob',
            });

            // Create blob and download
            const blob = new Blob([response.data]);
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Erro ao baixar arquivo',
                description: err.response?.data?.message || 'Erro desconhecido',
                variant: 'destructive',
            });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <div className="text-gray-500">Carregando arquivos do agente...</div>
                </div>
            </div>
        );
    }

    if (!files) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-red-500">Erro ao carregar arquivos do agente</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Downloads do Agente</h1>
                    <p className="text-muted-foreground mt-1">
                        Baixe os arquivos necessários para instalar o agente em novos computadores
                    </p>
                </div>
                <Button onClick={fetchFiles} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {/* Informações Gerais */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Informações Gerais
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Versão Mais Recente</p>
                            <p className="text-2xl font-bold">{files.latest_version}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pacotes Disponíveis</p>
                            <p className="text-2xl font-bold">{files.packages.filter(p => p.exists).length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Pacotes ZIP */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Pacotes ZIP do Agente
                    </CardTitle>
                    <CardDescription>
                        Pacotes de atualização do agente para instalação em computadores
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {files.packages.length === 0 ? (
                        <div className="space-y-4">
                            <div className="text-center py-4 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                                <p className="font-medium">Nenhum pacote disponível</p>
                                <p className="text-sm mt-2">Os pacotes ZIP são usados para atualizar agentes já instalados.</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                    Como criar um pacote de atualização:
                                </p>
                                <ol className="text-sm text-blue-800 dark:text-blue-200 list-decimal list-inside space-y-1 ml-2">
                                    <li>Execute no servidor: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">php artisan agent:build-package [versão]</code></li>
                                    <li>Exemplo: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">php artisan agent:build-package 1.0.0</code></li>
                                    <li>O pacote será criado em <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">storage/app/agent/packages/</code></li>
                                    <li>O pacote contém os arquivos necessários para atualizar o agente</li>
                                </ol>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                                    <strong>Nota:</strong> Os agentes instalados podem verificar e baixar atualizações automaticamente usando o arquivo <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">update.py</code>.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Versão</TableHead>
                                    <TableHead>Tamanho</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {files.packages.map((pkg: AgentPackage) => (
                                    <TableRow key={pkg.version}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{pkg.version}</span>
                                                {pkg.is_latest && (
                                                    <Badge variant="default" className="bg-green-500">
                                                        Mais Recente
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{pkg.size_human}</TableCell>
                                        <TableCell>
                                            {pkg.exists ? (
                                                <Badge className="bg-green-500">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Disponível
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive">
                                                    <XCircle className="h-3 w-3 mr-1" />
                                                    Não encontrado
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString('pt-BR') : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {pkg.exists ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDownload(pkg.download_url, `iflab-agent-${pkg.version}.zip`)}
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Baixar
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Scripts de Instalação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {files.installers.map((installer: AgentInstaller) => (
                    <Card key={installer.platform}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {installer.platform === 'windows' ? (
                                    <Monitor className="h-5 w-5" />
                                ) : (
                                    <Server className="h-5 w-5" />
                                )}
                                {installer.platform === 'windows' ? 'Windows' : 'Linux'}
                            </CardTitle>
                            <CardDescription>
                                Script de instalação para {installer.platform === 'windows' ? 'Windows' : 'Linux'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {installer.exists ? (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Arquivo:</span>
                                            <span className="font-medium">{installer.filename}</span>
                                        </div>
                                        {installer.size && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Tamanho:</span>
                                                <span className="font-medium">{installer.size_human}</span>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        className="w-full"
                                        onClick={() => handleDownload(installer.download_url!, installer.filename)}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Baixar {installer.filename}
                                    </Button>
                                    <div className="text-xs text-muted-foreground pt-2 border-t space-y-2">
                                        {installer.platform === 'windows' ? (
                                            <>
                                                <p className="font-semibold">Instruções de Instalação (Windows):</p>
                                                <ol className="list-decimal list-inside space-y-1 ml-2">
                                                    <li>Baixe o script <code className="bg-gray-100 px-1 rounded">install_windows.ps1</code></li>
                                                    <li>Abra o PowerShell como <strong>Administrador</strong> (clique com botão direito → "Executar como administrador")</li>
                                                    <li>Navegue até o diretório onde baixou o script</li>
                                                    <li>Execute: <code className="bg-gray-100 px-1 rounded">.\install_windows.ps1</code></li>
                                                    <li>O script irá instalar o agente como um serviço do Windows</li>
                                                </ol>
                                                <p className="text-yellow-600 dark:text-yellow-400 mt-2">
                                                    <strong>Nota:</strong> Se encontrar erro de política de execução, execute primeiro: 
                                                    <code className="bg-gray-100 px-1 rounded ml-1">Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser</code>
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="font-semibold">Instruções de Instalação (Linux):</p>
                                                <ol className="list-decimal list-inside space-y-1 ml-2">
                                                    <li>Baixe o script <code className="bg-gray-100 px-1 rounded">install_linux.sh</code></li>
                                                    <li>Dê permissão de execução: <code className="bg-gray-100 px-1 rounded">chmod +x install_linux.sh</code></li>
                                                    <li>Execute como root: <code className="bg-gray-100 px-1 rounded">sudo ./install_linux.sh</code></li>
                                                    <li>O script irá instalar o agente como um serviço systemd</li>
                                                </ol>
                                                <p className="text-yellow-600 dark:text-yellow-400 mt-2">
                                                    <strong>Nota:</strong> Certifique-se de ter Python 3 instalado antes de executar o script.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                    <XCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                    <p>Script não encontrado</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Código-fonte */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileCode className="h-5 w-5" />
                        Código-fonte Completo
                    </CardTitle>
                    <CardDescription>
                        Download do código-fonte completo do agente em formato ZIP
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {files.source_code.available ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-muted-foreground">Tamanho estimado</p>
                                    <p className="text-lg font-medium">{files.source_code.size_human}</p>
                                </div>
                                <Button
                                    onClick={() => handleDownload(files.source_code.download_url!, `iflab-agent-source-${files.latest_version}.zip`)}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Baixar Código-fonte
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground pt-2 border-t space-y-2">
                                <p className="font-semibold">Conteúdo do ZIP:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Arquivos principais: main.py, config.py, update.py</li>
                                    <li>Scripts de instalação: install_windows.ps1, install_linux.sh</li>
                                    <li>Dependências: requirements.txt</li>
                                    <li>Documentação: README.md (se disponível)</li>
                                </ul>
                                <p className="mt-2">Arquivos excluídos: .venv, __pycache__, node_modules, .git</p>
                                <p className="mt-2 text-yellow-600 dark:text-yellow-400">
                                    <strong>Uso:</strong> Extraia o ZIP, instale as dependências com <code className="bg-gray-100 px-1 rounded">pip install -r requirements.txt</code> e configure o <code className="bg-gray-100 px-1 rounded">config.py</code> antes de executar.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground">
                            <XCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>Código-fonte não disponível</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
