import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ExportDialogProps {
    trigger: React.ReactNode;
    onExport: (format: 'pdf' | 'csv' | 'xlsx') => Promise<void>;
    title?: string;
    description?: string;
}

export default function ExportDialog({ trigger, onExport, title = 'Exportar Relatório', description }: ExportDialogProps) {
    const [format, setFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const { toast } = useToast();

    const handleExport = async () => {
        try {
            setIsExporting(true);
            await onExport(format);
            toast({
                title: 'Exportação concluída!',
                description: `Relatório exportado em formato ${format.toUpperCase()}.`,
            });
            setIsOpen(false);
        } catch (error: any) {
            toast({
                title: 'Erro na exportação',
                description: error.message || 'Falha ao exportar relatório.',
                variant: 'destructive',
            });
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
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isExporting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleExport} disabled={isExporting}>
                            {isExporting ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    Exportando...
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
