import { useState, useEffect, useCallback } from 'react';
import LogViewerService, { LogFile, LogContent } from '@/services/LogViewerService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, FileText, Download, AlertCircle, Search, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LogViewer() {
    const [files, setFiles] = useState<LogFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [logContent, setLogContent] = useState<LogContent | null>(null);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [loadingContent, setLoadingContent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters & Sorting
    const [fileSearch, setFileSearch] = useState('');
    const [fileSort, setFileSort] = useState<'name' | 'size' | 'date'>('date');
    const [contentSearch, setContentSearch] = useState('');
    const [logLevel, setLogLevel] = useState<string>('ALL');
    const [autoRefresh, setAutoRefresh] = useState(false);

    // Derived state for files
    const filteredFiles = files
        .filter(f => f.filename.toLowerCase().includes(fileSearch.toLowerCase()))
        .sort((a, b) => {
            if (fileSort === 'name') return a.filename.localeCompare(b.filename);
            if (fileSort === 'size') return b.size - a.size;
            if (fileSort === 'date') return b.last_modified - a.last_modified;
            return 0;
        });

    // Derived state for content
    const filteredLines = logContent?.content ? logContent.content.split('\n').filter(line => {
        if (contentSearch && !line.toLowerCase().includes(contentSearch.toLowerCase())) return false;
        if (logLevel !== 'ALL' && !line.includes(`.${logLevel}`)) return false;
        return true;
    }) : [];

    // Auto-refresh logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (autoRefresh && selectedFile) {
            interval = setInterval(() => {
                fetchContent(selectedFile, true); // Create silent refresh param
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [autoRefresh, selectedFile]);

    const fetchFiles = useCallback(async () => {
        try {
            setLoadingFiles(true);
            setError(null);
            const data = await LogViewerService.getFiles();
            setFiles(data);
        } catch (err) {
            setError('Failed to load log files.');
            console.error(err);
        } finally {
            setLoadingFiles(false);
        }
    }, []);

    const fetchContent = async (filename: string, silent = false) => {
        try {
            if (!silent) setLoadingContent(true);
            setError(null);
            const data = await LogViewerService.getFileContent(filename);
            setLogContent(data);
        } catch (err) {
            setError(`Failed to load content for ${filename}`);
            console.error(err);
        } finally {
            setLoadingContent(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    useEffect(() => {
        if (selectedFile) {
            fetchContent(selectedFile);
        } else {
            setLogContent(null);
        }
    }, [selectedFile]);

    const handleDownload = () => {
        if (!logContent) return;
        const blob = new Blob([logContent.content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = logContent.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    // Helper to colorize log lines slightly
    const renderLogLine = (line: string, index: number) => {
        let className = "text-sm font-mono whitespace-pre-wrap break-all py-0.5 px-2 hover:bg-gray-800/50";
        if (line.includes('.ERROR') || line.includes('.CRITICAL') || line.includes('.ALERT') || line.includes('.EMERGENCY')) {
            className += " text-red-400";
        } else if (line.includes('.WARNING')) {
            className += " text-yellow-400";
        } else if (line.includes('.INFO')) {
            className += " text-blue-400";
        } else if (line.includes('.DEBUG')) {
            className += " text-gray-400";
        } else {
            className += " text-gray-300";
        }

        return (
            <div key={index} className={className}>
                <span className="select-none text-gray-600 mr-2 text-xs w-8 inline-block text-right">{index + 1}</span>
                {line}
            </div>
        );
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FileText className="h-6 w-6" />
                    Log Viewer
                </h1>
                <Button onClick={fetchFiles} variant="outline" size="sm" disabled={loadingFiles}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", loadingFiles && "animate-spin")} />
                    Atualizar Lista
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-4 h-full overflow-hidden">
                {/* File List */}
                <Card className="col-span-3 h-full flex flex-col">
                    <CardHeader className="py-3 px-4 border-b space-y-2">
                        <CardTitle className="text-sm font-medium">Arquivos de Log</CardTitle>
                        <div className="flex flex-col gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                    placeholder="Buscar arquivo..."
                                    value={fileSearch}
                                    onChange={(e) => setFileSearch(e.target.value)}
                                    className="h-8 pl-8 text-xs"
                                />
                            </div>
                            <Select value={fileSort} onValueChange={(v: string) => setFileSort(v as 'name' | 'size' | 'date')}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Ordenar por" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date">Data (Recente)</SelectItem>
                                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                                    <SelectItem value="size">Tamanho (Maior)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            {loadingFiles ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="p-4 text-sm text-gray-500 text-center">Nenhum log encontrado</div>
                            ) : (
                                <div className="divide-y">
                                    {filteredFiles.map((file) => (
                                        <button
                                            key={file.filename}
                                            onClick={() => setSelectedFile(file.filename)}
                                            className={cn(
                                                "w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex flex-col gap-1",
                                                selectedFile === file.filename && "bg-primary/5 border-l-2 border-primary"
                                            )}
                                        >
                                            <span className="font-medium truncate block w-full" title={file.filename}>
                                                {file.filename}
                                            </span>
                                            <div className="flex justify-between text-xs text-gray-400">
                                                <span>{file.formatted_size}</span>
                                                <span>{file.formatted_last_modified}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Log Content */}
                <Card className="col-span-9 h-full flex flex-col border-0 shadow-none md:border md:shadow-sm bg-[#1e1e1e] text-gray-300">
                    <div className="flex flex-col gap-2 p-3 border-b border-gray-800 bg-[#252526]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {selectedFile ? (
                                    <span className="font-mono text-sm text-gray-200 flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        {selectedFile}
                                    </span>
                                ) : (
                                    <span className="text-sm text-gray-500">Selecione um arquivo</span>
                                )}
                            </div>
                            {selectedFile && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 mr-4 border-r border-gray-700 pr-4">
                                        <Switch
                                            id="auto-refresh"
                                            checked={autoRefresh}
                                            onCheckedChange={setAutoRefresh}
                                            className="data-[state=checked]:bg-green-500"
                                        />
                                        <label htmlFor="auto-refresh" className="text-xs cursor-pointer select-none text-gray-400 flex items-center gap-1">
                                            {autoRefresh ? <Play className="h-3 w-3 text-green-500" /> : <Pause className="h-3 w-3" />}
                                            Auto-Leitura
                                        </label>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-gray-400 hover:text-white hover:bg-gray-700"
                                        onClick={() => fetchContent(selectedFile)}
                                        disabled={loadingContent}
                                    >
                                        <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loadingContent && "animate-spin")} />
                                        Atualizar
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-gray-400 hover:text-white hover:bg-gray-700"
                                        onClick={handleDownload}
                                    >
                                        <Download className="h-3.5 w-3.5 mr-2" />
                                        Baixar
                                    </Button>
                                </div>
                            )}
                        </div>
                        {selectedFile && (
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-500" />
                                    <Input
                                        placeholder="Buscar no conteúdo..."
                                        value={contentSearch}
                                        onChange={(e) => setContentSearch(e.target.value)}
                                        className="h-8 pl-8 text-xs bg-[#1e1e1e] border-gray-700 text-gray-300 focus-visible:ring-gray-600"
                                    />
                                </div>
                                <Select value={logLevel} onValueChange={setLogLevel}>
                                    <SelectTrigger className="h-8 w-[120px] text-xs bg-[#1e1e1e] border-gray-700 text-gray-300">
                                        <SelectValue placeholder="Nível" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1e1e1e] border-gray-700 text-gray-300">
                                        <SelectItem value="ALL">Todos</SelectItem>
                                        <SelectItem value="INFO">INFO</SelectItem>
                                        <SelectItem value="ERROR">ERROR</SelectItem>
                                        <SelectItem value="WARNING">WARNING</SelectItem>
                                        <SelectItem value="DEBUG">DEBUG</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {loadingContent ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 z-10">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : error ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-2">
                                <AlertCircle className="h-8 w-8" />
                                <p>{error}</p>
                            </div>
                        ) : !selectedFile ? (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                <p>Selecione um arquivo de log para visualizar</p>
                            </div>
                        ) : (
                            <div className="h-full w-full overflow-auto">
                                <div className="p-4">
                                    {filteredLines.length === 0 ? (
                                        <div className="text-gray-500 text-sm italic p-4">Nenhuma linha corresponde aos filtros.</div>
                                    ) : (
                                        filteredLines.map((line, i) => renderLogLine(line, i))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
