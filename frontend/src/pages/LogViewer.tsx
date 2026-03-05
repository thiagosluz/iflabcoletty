import React, { useState, useEffect, useCallback } from 'react';
import LogViewerService, {
    LogFile,
    LogContent,
    LogEntry,
    LogLevelStats,
} from '@/services/LogViewerService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Loader2,
    RefreshCw,
    FileText,
    Download,
    AlertCircle,
    Search,
    ChevronLeft,
    ChevronRight,
    AlignLeft,
    List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_LABELS: Record<string, string> = {
    ERROR: 'Error',
    WARNING: 'Warning',
    INFO: 'Info',
    DEBUG: 'Debug',
    NOTICE: 'Notice',
    CRITICAL: 'Critical',
    ALERT: 'Alert',
    EMERGENCY: 'Emergency',
    OTHER: 'Other',
};

const LEVEL_COLORS: Record<string, string> = {
    ERROR: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
    WARNING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    INFO: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    DEBUG: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30',
    NOTICE: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    CRITICAL: 'bg-red-600/20 text-red-700 dark:text-red-300 border-red-600/40',
    ALERT: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    EMERGENCY: 'bg-red-700/20 text-red-800 dark:text-red-200 border-red-700/50',
    OTHER: 'bg-muted text-muted-foreground border-border',
};

const PER_PAGE_OPTIONS = [25, 50, 100] as const;

export default function LogViewer() {
    const [files, setFiles] = useState<LogFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'structured' | 'text'>('structured');

    const [loadingFiles, setLoadingFiles] = useState(false);
    const [loadingContent, setLoadingContent] = useState(false);
    const [loadingStats, setLoadingStats] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [fileSearch, setFileSearch] = useState('');
    const [fileSort, setFileSort] = useState<'name' | 'size' | 'date'>('date');

    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [stats, setStats] = useState<LogLevelStats | null>(null);
    const [meta, setMeta] = useState<{ page: number; per_page: number; total: number; total_pages: number } | null>(null);
    const [levelFilter, setLevelFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);

    const [logContent, setLogContent] = useState<LogContent | null>(null);
    const [contentSearch, setContentSearch] = useState('');
    const [logLevel, setLogLevel] = useState<string>('ALL');
    const TAIL_OPTIONS = [500, 1000, 2000, 5000, 10000] as const;
    const [tailLines, setTailLines] = useState<number>(2000);

    const filteredFiles = files
        .filter(f => f.filename.toLowerCase().includes(fileSearch.toLowerCase()))
        .sort((a, b) => {
            if (fileSort === 'name') return a.filename.localeCompare(b.filename);
            if (fileSort === 'size') return b.size - a.size;
            if (fileSort === 'date') return b.last_modified - a.last_modified;
            return 0;
        });

    const fetchFiles = useCallback(async () => {
        try {
            setLoadingFiles(true);
            setError(null);
            const data = await LogViewerService.getFiles();
            setFiles(data);
        } catch (err) {
            setError('Falha ao carregar arquivos.');
            console.error(err);
        } finally {
            setLoadingFiles(false);
        }
    }, []);

    const fetchEntries = useCallback(
        async (filename: string, silent = false) => {
            try {
                if (!silent) setLoadingContent(true);
                setError(null);
                const res = await LogViewerService.getLogEntries(filename, {
                    page,
                    per_page: perPage,
                    level: levelFilter,
                    search: searchQuery || undefined,
                    order,
                });
                setEntries(res.data);
                setMeta(res.meta);
            } catch (err) {
                setError(`Falha ao carregar entradas de ${filename}`);
                setEntries([]);
                setMeta(null);
                console.error(err);
            } finally {
                setLoadingContent(false);
            }
        },
        [page, perPage, levelFilter, searchQuery, order]
    );

    const fetchStats = useCallback(async (filename: string) => {
        try {
            setLoadingStats(true);
            const res = await LogViewerService.getLogStats(filename);
            setStats(res);
        } catch {
            setStats(null);
        } finally {
            setLoadingStats(false);
        }
    }, []);

    const fetchContent = async (filename: string, silent = false) => {
        try {
            if (!silent) setLoadingContent(true);
            setError(null);
            const data = await LogViewerService.getFileContent(filename, { tail: tailLines });
            setLogContent(data);
        } catch (err) {
            setError(`Falha ao carregar conteúdo de ${filename}`);
            console.error(err);
        } finally {
            setLoadingContent(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    useEffect(() => {
        if (!selectedFile) {
            setEntries([]);
            setMeta(null);
            setStats(null);
            setLogContent(null);
            return;
        }
        if (viewMode === 'structured') {
            setPage(1);
            fetchStats(selectedFile);
            fetchEntries(selectedFile);
        } else {
            fetchContent(selectedFile);
        }
    }, [selectedFile, viewMode]);

    useEffect(() => {
        if (selectedFile && viewMode === 'structured') {
            fetchEntries(selectedFile);
        }
    }, [selectedFile, viewMode, page, perPage, levelFilter, searchQuery, order, fetchEntries]);

    useEffect(() => {
        if (selectedFile && viewMode === 'text') {
            fetchContent(selectedFile);
        }
    }, [selectedFile, viewMode, tailLines]);

    const handleSearchSubmit = () => {
        setSearchQuery(searchInput);
        setPage(1);
    };

    const handleDownload = async () => {
        if (!selectedFile) return;
        try {
            const blob = await LogViewerService.downloadFile(selectedFile);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = selectedFile;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError('Falha ao baixar o arquivo.');
            console.error(err);
        }
    };

    const selectedFileInfo = files.find(f => f.filename === selectedFile);

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FileText className="h-6 w-6" />
                    Log Viewer
                </h1>
                <Button onClick={fetchFiles} variant="outline" size="sm" disabled={loadingFiles}>
                    <RefreshCw className={cn('h-4 w-4 mr-2', loadingFiles && 'animate-spin')} />
                    Atualizar Lista
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-4 h-full overflow-hidden min-h-0">
                <Card className="col-span-2 md:col-span-3 h-full flex flex-col min-h-0">
                    <CardHeader className="py-3 px-4 border-b space-y-2">
                        <CardTitle className="text-sm font-medium">Arquivos de Log</CardTitle>
                        <div className="flex flex-col gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar arquivo..."
                                    value={fileSearch}
                                    onChange={e => setFileSearch(e.target.value)}
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
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">Nenhum log encontrado</div>
                            ) : (
                                <div className="divide-y">
                                    {filteredFiles.map(file => (
                                        <button
                                            key={file.filename}
                                            onClick={() => setSelectedFile(file.filename)}
                                            className={cn(
                                                'w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors flex flex-col gap-1',
                                                selectedFile === file.filename && 'bg-primary/10 border-l-2 border-primary'
                                            )}
                                        >
                                            <span className="font-medium truncate block w-full" title={file.filename}>
                                                {file.filename}
                                            </span>
                                            <div className="flex justify-between text-xs text-muted-foreground">
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

                <Card className="col-span-10 md:col-span-9 h-full flex flex-col min-h-0">
                    <div className="flex flex-col gap-3 p-3 border-b">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                {selectedFile ? (
                                    <span className="font-mono text-sm font-medium flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        {selectedFile}
                                        {selectedFileInfo && (
                                            <span className="text-muted-foreground font-normal">
                                                · {selectedFileInfo.formatted_size}
                                            </span>
                                        )}
                                    </span>
                                ) : (
                                    <span className="text-sm text-muted-foreground">Selecione um arquivo</span>
                                )}
                                {selectedFile && (
                                    <>
                                        <Button
                                            variant={viewMode === 'structured' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className="h-8"
                                            onClick={() => setViewMode('structured')}
                                        >
                                            <List className="h-3.5 w-3.5 mr-2" />
                                            Estruturado
                                        </Button>
                                        <Button
                                            variant={viewMode === 'text' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className="h-8"
                                            onClick={() => setViewMode('text')}
                                        >
                                            <AlignLeft className="h-3.5 w-3.5 mr-2" />
                                            Como texto
                                        </Button>
                                    </>
                                )}
                            </div>
                            {selectedFile && (
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="h-8" onClick={() => (viewMode === 'structured' ? fetchEntries(selectedFile) : fetchContent(selectedFile))} disabled={loadingContent}>
                                        <RefreshCw className={cn('h-3.5 w-3.5 mr-2', loadingContent && 'animate-spin')} />
                                        Atualizar
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8" onClick={handleDownload}>
                                        <Download className="h-3.5 w-3.5 mr-2" />
                                        Baixar
                                    </Button>
                                </div>
                            )}
                        </div>

                        {selectedFile && viewMode === 'structured' && (
                            <>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar na mensagem..."
                                            value={searchInput}
                                            onChange={e => setSearchInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
                                            className="h-8 pl-8 text-xs"
                                        />
                                    </div>
                                    <Button size="sm" className="h-8" onClick={handleSearchSubmit}>
                                        Buscar
                                    </Button>
                                    <Select value={order} onValueChange={(v: 'newest' | 'oldest') => setOrder(v)}>
                                        <SelectTrigger className="h-8 w-[140px] text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="newest">Mais recentes primeiro</SelectItem>
                                            <SelectItem value="oldest">Mais antigos primeiro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={String(perPage)} onValueChange={v => setPerPage(Number(v) as 25 | 50 | 100)}>
                                        <SelectTrigger className="h-8 w-[130px] text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PER_PAGE_OPTIONS.map(n => (
                                                <SelectItem key={n} value={String(n)}>
                                                    {n} itens por página
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => setLevelFilter(null)}
                                        className={cn(
                                            'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                                            levelFilter === null
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-muted/50 hover:bg-muted border-transparent'
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {stats?.levels &&
                                        Object.entries(stats.levels)
                                            .filter(([, count]) => count > 0)
                                            .map(([level]) => (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    onClick={() => {
                                                        setLevelFilter(level);
                                                        setPage(1);
                                                    }}
                                                    className={cn(
                                                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                                                        levelFilter === level
                                                            ? 'ring-2 ring-offset-1 ring-primary'
                                                            : 'hover:opacity-90',
                                                        LEVEL_COLORS[level] ?? LEVEL_COLORS.OTHER
                                                    )}
                                                >
                                                    {LEVEL_LABELS[level] ?? level} · {stats.levels[level]}
                                                </button>
                                            ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden relative">
                        {error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive gap-2 p-4 bg-destructive/5 z-10">
                                <AlertCircle className="h-8 w-8" />
                                <p>{error}</p>
                                <p className="text-sm text-muted-foreground">Use &quot;Baixar&quot; para obter o arquivo completo.</p>
                            </div>
                        )}
                        {!selectedFile && !error && (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                Selecione um arquivo de log para visualizar
                            </div>
                        )}

                        {selectedFile && viewMode === 'structured' && !error && (
                            <div className="h-full flex flex-col overflow-hidden">
                                {loadingContent ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <>
                                        <ScrollArea className="flex-1 min-h-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[100px]">Nível</TableHead>
                                                        <TableHead className="w-[160px]">Data</TableHead>
                                                        <TableHead className="w-[80px]">Env</TableHead>
                                                        <TableHead>Mensagem</TableHead>
                                                        <TableHead className="w-[70px] text-right">Linha</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {entries.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                                Nenhuma entrada corresponde aos filtros.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        entries.map(entry => (
                                                            <TableRow key={`${entry.lineNumber}-${entry.id}`}>
                                                                <TableCell>
                                                                    {entry.level && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={cn('text-xs', LEVEL_COLORS[entry.level] ?? LEVEL_COLORS.OTHER)}
                                                                        >
                                                                            {LEVEL_LABELS[entry.level] ?? entry.level}
                                                                        </Badge>
                                                                    )}
                                                                    {!entry.level && <span className="text-muted-foreground text-xs">—</span>}
                                                                </TableCell>
                                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                                    {entry.timestamp ?? '—'}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {entry.env ?? '—'}
                                                                </TableCell>
                                                                <TableCell className="max-w-[400px]">
                                                                    <span
                                                                        className="block truncate font-mono text-xs cursor-help"
                                                                        title={entry.message}
                                                                    >
                                                                        {entry.message}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                                    {entry.lineNumber.toLocaleString()}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>

                                        {meta && meta.total_pages > 0 && (
                                            <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-sm">
                                                <span className="text-muted-foreground">
                                                    Mostrando {(meta.page - 1) * meta.per_page + 1}–{Math.min(meta.page * meta.per_page, meta.total)} de {meta.total}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        disabled={meta.page <= 1}
                                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="px-2 text-muted-foreground">
                                                        Página {meta.page} de {meta.total_pages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        disabled={meta.page >= meta.total_pages}
                                                        onClick={() => setPage(p => p + 1)}
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {selectedFile && viewMode === 'text' && !error && (
                            <LogViewerTextView
                                logContent={logContent}
                                loading={loadingContent}
                                tailLines={tailLines}
                                setTailLines={setTailLines}
                                contentSearch={contentSearch}
                                setContentSearch={setContentSearch}
                                logLevel={logLevel}
                                setLogLevel={setLogLevel}
                                TAIL_OPTIONS={TAIL_OPTIONS}
                                fetchContent={() => fetchContent(selectedFile)}
                            />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function LogViewerTextView({
    logContent,
    loading,
    tailLines,
    setTailLines,
    contentSearch,
    setContentSearch,
    logLevel,
    setLogLevel,
    TAIL_OPTIONS,
    fetchContent,
}: {
    logContent: LogContent | null;
    loading: boolean;
    tailLines: number;
    setTailLines: (n: number) => void;
    contentSearch: string;
    setContentSearch: (s: string) => void;
    logLevel: string;
    setLogLevel: (s: string) => void;
    TAIL_OPTIONS: readonly number[];
    fetchContent: () => void;
}) {
    const linesWithNumbers: { lineNumber: number; text: string }[] = logContent?.content
        ? logContent.content.split('\n').map((text, index) => ({
              lineNumber: (logContent.from_line ?? 1) + index,
              text,
          }))
        : [];

    const filteredLines = linesWithNumbers.filter(({ text }) => {
        if (contentSearch && !text.toLowerCase().includes(contentSearch.toLowerCase())) return false;
        if (logLevel !== 'ALL' && !text.includes(`.${logLevel}`)) return false;
        return true;
    });

    const getLevelClass = (text: string) => {
        if (text.includes('.ERROR') || text.includes('.CRITICAL') || text.includes('.ALERT') || text.includes('.EMERGENCY')) return 'text-red-400';
        if (text.includes('.WARNING')) return 'text-yellow-400';
        if (text.includes('.INFO')) return 'text-blue-400';
        if (text.includes('.DEBUG')) return 'text-gray-400';
        return 'text-gray-300';
    };

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
            <div className="flex items-center gap-2 p-2 border-b border-gray-800 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-500" />
                    <Input
                        placeholder="Buscar no conteúdo..."
                        value={contentSearch}
                        onChange={e => setContentSearch(e.target.value)}
                        className="h-8 pl-8 text-xs bg-[#252526] border-gray-700 text-gray-300"
                    />
                </div>
                <Select value={logLevel} onValueChange={setLogLevel}>
                    <SelectTrigger className="h-8 w-[120px] text-xs bg-[#252526] border-gray-700 text-gray-300">
                        <SelectValue placeholder="Nível" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] border-gray-700">
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="INFO">INFO</SelectItem>
                        <SelectItem value="ERROR">ERROR</SelectItem>
                        <SelectItem value="WARNING">WARNING</SelectItem>
                        <SelectItem value="DEBUG">DEBUG</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={String(tailLines)} onValueChange={v => setTailLines(Number(v))}>
                    <SelectTrigger className="h-8 w-[160px] text-xs bg-[#252526] border-gray-700 text-gray-300">
                        <SelectValue placeholder="Linhas" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] border-gray-700">
                        {TAIL_OPTIONS.map(n => (
                            <SelectItem key={n} value={String(n)}>
                                Últimas {n} linhas
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-8 text-gray-400" onClick={fetchContent} disabled={loading}>
                    <RefreshCw className={cn('h-3.5 w-3.5 mr-2', loading && 'animate-spin')} />
                    Atualizar
                </Button>
            </div>
            {logContent?.truncated && (
                <div className="px-3 py-2 bg-amber-900/30 border-b border-amber-700/50 text-amber-200 text-xs">
                    Mostrando últimas linhas. Use &quot;Baixar&quot; para o arquivo completo.
                </div>
            )}
            <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    filteredLines.map((item, i) => (
                        <div
                            key={`${item.lineNumber}-${i}`}
                            className={cn('py-0.5 px-2 hover:bg-gray-800/50 whitespace-pre-wrap break-all', getLevelClass(item.text))}
                        >
                            <span className="select-none text-gray-600 mr-2 text-xs min-w-[2.5rem] inline-block text-right">{item.lineNumber}</span>
                            {item.text}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
