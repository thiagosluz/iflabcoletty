import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';

interface ExportDialogProps {
    trigger: React.ReactNode;
    onExport: (format: 'pdf' | 'csv' | 'xlsx', async?: boolean) => Promise<void>;
    title?: string;
    description?: string;
    defaultAsync?: boolean;
}

export default function ExportDialog({ 
    trigger, 
    onExport, 
    title = 'Exportar Relatório', 
    description,
    defaultAsync = true 
}: ExportDialogProps) {
    const [format, setFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [useAsync, setUseAsync] = useState(defaultAsync);
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleExport = async () => {
        try {
            setIsExporting(true);
            await onExport(format, useAsync);
            
            if (useAsync) {
                toast({
                    title: 'Relatório em processamento!',
                    description: 'Você será redirecionado para acompanhar o status.',
                });
                setIsOpen(false);
                // Small delay to allow the toast to show
                setTimeout(() => {
                    navigate('/admin/report-jobs');
                }, 500);
            } else {
                toast({
                    title: 'Exportação concluída!',
                    description: `Relatório exportado em formato ${format.toUpperCase()}.`,
                });
                setIsOpen(false);
            }
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <p className="text-sm text-gray-500 mt-2">{description}</p>
                    )}
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Formato de Exportação</Label>
                        <Select value={format} onValueChange={(value: 'pdf' | 'csv' | 'xlsx') => setFormat(value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pdf">PDF (Documento)</SelectItem>
                                <SelectItem value="csv">CSV (Planilha - Excel/Calc)</SelectItem>
                                <SelectItem value="xlsx">XLSX (Excel)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="async"
                            checked={useAsync}
                            onCheckedChange={(checked) => setUseAsync(checked === true)}
                        />
                        <Label htmlFor="async" className="text-sm font-normal cursor-pointer">
                            Processar em background (recomendado para relatórios grandes)
                        </Label>
                    </div>
                    {useAsync && (
                        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            <ExternalLink className="h-4 w-4 inline mr-1" />
                            Você será redirecionado para acompanhar o status do processamento.
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isExporting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleExport} disabled={isExporting}>
                            {isExporting ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    {useAsync ? 'Enviando...' : 'Exportando...'}
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
