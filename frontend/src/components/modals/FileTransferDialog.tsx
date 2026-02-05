import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, Link, Network, CheckCircle2, XCircle, Clock } from 'lucide-react';
import FileTransferService, {
    FileTransfer,
    TransferCommandStatusResponse,
    TransferCommandItem,
} from '@/services/FileTransferService';

interface FileTransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targets: {
        computers?: number[];
        labs?: number[];
    };
    onSuccess?: () => void;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function StatusIcon({ status }: { status: TransferCommandItem['status'] }) {
    if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'processing') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
}

export function FileTransferDialog({ open, onOpenChange, targets, onSuccess }: FileTransferDialogProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('upload');
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');
    const [filename, setFilename] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'progress'>('form');
    const [progressTransferId, setProgressTransferId] = useState<number | null>(null);
    const [progressData, setProgressData] = useState<TransferCommandStatusResponse | null>(null);
    const pollStartedAt = useRef<number | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    // Poll command status when showing progress
    useEffect(() => {
        if (step !== 'progress' || progressTransferId == null) return;

        const fetchStatus = async () => {
            try {
                const data = await FileTransferService.getCommandStatus(progressTransferId);
                setProgressData(data);
                const { summary } = data;
                const inProgress = (summary.pending + summary.processing) > 0;
                const timedOut = pollStartedAt.current != null && Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS;
                if (!inProgress || timedOut) {
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                }
            } catch {
                // keep previous data, polling continues
            }
        };

        pollStartedAt.current = Date.now();
        fetchStatus();
        pollIntervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [step, progressTransferId]);

    const handleCloseProgress = () => {
        setStep('form');
        setProgressTransferId(null);
        setProgressData(null);
        if (onSuccess) onSuccess();
        onOpenChange(false);
    };

    useEffect(() => {
        if (!open) {
            setStep('form');
            setProgressTransferId(null);
            setProgressData(null);
        }
    }, [open]);

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            let transfer: FileTransfer;

            // 1. Create/Upload Transfer Record
            if (activeTab === 'upload') {
                if (!file) {
                    toast({ title: 'Erro', description: 'Selecione um arquivo.', variant: 'destructive' });
                    setIsLoading(false);
                    return;
                }
                transfer = await FileTransferService.upload(file);
            } else if (activeTab === 'link') {
                if (!url) {
                    toast({ title: 'Erro', description: 'Digite uma URL.', variant: 'destructive' });
                    setIsLoading(false);
                    return;
                }
                transfer = await FileTransferService.registerLink(url, 'link', filename);
            } else {
                // Network Path
                if (!url) {
                    toast({ title: 'Erro', description: 'Digite o caminho da rede.', variant: 'destructive' });
                    setIsLoading(false);
                    return;
                }
                transfer = await FileTransferService.registerLink(url, 'network_path', filename);
            }

            // 2. Send Command
            await FileTransferService.send({
                file_transfer_id: transfer.id,
                targets: targets,
            });

            setProgressTransferId(transfer.id);
            setProgressData(null);
            setStep('progress');
            setFile(null);
            setUrl('');
            setFilename('');
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Erro no envio',
                description: error.response?.data?.message || 'Falha ao enviar arquivo.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const targetCount = (targets.computers?.length || 0) + (targets.labs?.length ? ` + ${targets.labs.length} Lab(s)` : '');
    const total = progressData?.total ?? 0;
    const doneCount = progressData ? progressData.summary.completed + progressData.summary.failed : 0;
    const progressPercent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const isProgressDone = progressData != null && progressData.summary.pending === 0 && progressData.summary.processing === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                {step === 'form' ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Enviar Arquivo para {targetCount}</DialogTitle>
                            <DialogDescription>
                                Envie arquivos ou links para serem abertos nos computadores selecionados.
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="upload" value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="upload"><Upload className="w-4 h-4 mr-2" /> Upload</TabsTrigger>
                                <TabsTrigger value="link"><Link className="w-4 h-4 mr-2" /> Web Link</TabsTrigger>
                                <TabsTrigger value="network"><Network className="w-4 h-4 mr-2" /> Rede/UNC</TabsTrigger>
                            </TabsList>

                            <TabsContent value="upload" className="space-y-4 py-4">
                                <div className="grid w-full max-w-sm items-center gap-1.5">
                                    <Label htmlFor="file">Arquivo</Label>
                                    <Input id="file" type="file" onChange={handleFileChange} />
                                    <p className="text-xs text-muted-foreground">Max 100MB. Expira em 24h.</p>
                                </div>
                            </TabsContent>

                            <TabsContent value="link" className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="url">URL do Link</Label>
                                    <Input id="url" placeholder="https://google.com" value={url} onChange={(e) => setUrl(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filename">Nome do Arquivo (Opcional)</Label>
                                    <Input id="filename" placeholder="Link.url" value={filename} onChange={(e) => setFilename(e.target.value)} />
                                </div>
                            </TabsContent>

                            <TabsContent value="network" className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="netpath">Caminho da Rede (UNC)</Label>
                                    <Input id="netpath" placeholder="\\Servidor\Pasta\Arquivo.pdf" value={url} onChange={(e) => setUrl(e.target.value)} />
                                    <p className="text-xs text-muted-foreground">O Agente deve ter acesso a este caminho (executa como SYSTEM).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="netfilename">Nome do Arquivo (Opcional)</Label>
                                    <Input id="netfilename" placeholder="Arquivo.pdf" value={filename} onChange={(e) => setFilename(e.target.value)} />
                                </div>
                            </TabsContent>
                        </Tabs>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button onClick={handleSubmit} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enviar
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Envio em andamento</DialogTitle>
                            <DialogDescription>
                                {isProgressDone
                                    ? 'Todos os computadores responderam.'
                                    : 'Aguardando os agentes receberem o arquivo...'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>{doneCount} de {total} computadores</span>
                                    <span>{progressPercent}%</span>
                                </div>
                                <Progress value={progressPercent} className="h-2" />
                            </div>
                            {progressData && progressData.commands.length > 0 && (
                                <ScrollArea className="h-[240px] rounded-md border p-2">
                                    <ul className="space-y-1.5">
                                        {progressData.commands.map((cmd) => (
                                            <li key={cmd.id} className="flex items-center gap-2 text-sm">
                                                <StatusIcon status={cmd.status} />
                                                <span className="flex-1 truncate font-medium">{cmd.computer_name}</span>
                                                <span className="text-muted-foreground text-xs">
                                                    {cmd.status === 'pending' && 'Pendente'}
                                                    {cmd.status === 'processing' && 'Recebendo...'}
                                                    {cmd.status === 'completed' && 'Recebido'}
                                                    {cmd.status === 'failed' && 'Falha'}
                                                </span>
                                                {cmd.status === 'failed' && cmd.output && (
                                                    <span className="max-w-[180px] truncate text-destructive text-xs" title={cmd.output}>{cmd.output}</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            )}
                        </div>

                        <DialogFooter>
                            <Button onClick={handleCloseProgress}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
