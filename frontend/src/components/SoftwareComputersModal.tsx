import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/axios';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Monitor } from 'lucide-react';

interface Computer {
    id: number;
    hostname: string | null;
    machine_id?: string;
    lab_id?: number;
    lab?: { id: number; name: string };
}

interface SoftwareComputersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    softwareId: number | null;
    softwareName: string;
    /** When set, only computers from this lab are shown (e.g. in LabDetails) */
    labId?: number | null;
}

export default function SoftwareComputersModal({
    open,
    onOpenChange,
    softwareId,
    softwareName,
    labId,
}: SoftwareComputersModalProps) {
    const navigate = useNavigate();
    const [computers, setComputers] = useState<Computer[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || softwareId == null) {
            setComputers([]);
            setError(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        apiClient
            .get(`/softwares/${softwareId}`)
            .then((res) => {
                if (cancelled) return;
                let list: Computer[] = res.data.computers ?? [];
                if (labId != null) {
                    list = list.filter(
                        (c) => c.lab_id === labId || c.lab?.id === labId
                    );
                }
                setComputers(list);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.response?.data?.message || 'Falha ao carregar computadores.');
                    setComputers([]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, softwareId, labId]);

    const handleComputerClick = (computerId: number) => {
        onOpenChange(false);
        navigate(`/admin/computers/${computerId}`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Computadores com &quot;{softwareName}&quot;
                    </DialogTitle>
                </DialogHeader>
                {loading && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        Carregando...
                    </div>
                )}
                {error && (
                    <div className="py-4 text-center text-sm text-destructive">
                        {error}
                    </div>
                )}
                {!loading && !error && computers.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum computador encontrado.
                    </div>
                )}
                {!loading && !error && computers.length > 0 && (
                    <ScrollArea className="max-h-[60vh] pr-4">
                        <ul className="space-y-2">
                            {computers.map((computer) => (
                                <li key={computer.id}>
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start gap-2 h-auto py-2"
                                        onClick={() => handleComputerClick(computer.id)}
                                    >
                                        <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate font-medium">
                                            {computer.hostname || computer.machine_id || `Computador ${computer.id}`}
                                        </span>
                                        {computer.lab?.name && (
                                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                                {computer.lab.name}
                                            </span>
                                        )}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}
