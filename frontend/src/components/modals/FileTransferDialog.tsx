import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, Link, Network } from 'lucide-react';
import FileTransferService, { FileTransfer } from '@/services/FileTransferService';

interface FileTransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targets: {
        computers?: number[];
        labs?: number[];
    };
    onSuccess?: () => void;
}

export function FileTransferDialog({ open, onOpenChange, targets, onSuccess }: FileTransferDialogProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('upload');
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');
    const [filename, setFilename] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

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
            const result = await FileTransferService.send({
                file_transfer_id: transfer.id,
                targets: targets,
            });

            toast({
                title: 'Sucesso',
                description: result.message,
            });

            if (onSuccess) onSuccess();
            onOpenChange(false);

            // Reset form
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
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
            </DialogContent>
        </Dialog>
    );
}
