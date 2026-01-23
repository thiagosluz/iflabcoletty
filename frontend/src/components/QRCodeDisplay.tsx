import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface QRCodeDisplayProps {
    value: string;
    size?: number;
    showActions?: boolean;
    title?: string;
}

export default function QRCodeDisplay({ 
    value, 
    size = 200, 
    showActions = true,
    title 
}: QRCodeDisplayProps) {
    const { toast } = useToast();

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(value);
            toast({
                title: 'Link copiado!',
                description: 'O link público foi copiado para a área de transferência.',
            });
        } catch (err) {
            toast({
                title: 'Erro',
                description: 'Não foi possível copiar o link.',
                variant: 'destructive',
            });
        }
    };

    const downloadQRCode = () => {
        const svg = document.getElementById('qrcode-svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = size;
            canvas.height = size;
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'qrcode.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast({
                            title: 'Download iniciado!',
                            description: 'O QR code foi baixado com sucesso.',
                        });
                    }
                });
            }
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            {title && (
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            )}
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <QRCodeSVG
                    id="qrcode-svg"
                    value={value}
                    size={size}
                    level="H"
                    marginSize={4}
                />
            </div>
            {showActions && (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                        className="flex items-center gap-2"
                    >
                        <Copy className="h-4 w-4" />
                        Copiar Link
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadQRCode}
                        className="flex items-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Baixar QR Code
                    </Button>
                </div>
            )}
            <p className="text-xs text-gray-500 text-center max-w-xs break-all">
                {value}
            </p>
        </div>
    );
}
