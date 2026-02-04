import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import apiClient from '@/lib/axios';
import { AlertRule } from '@/types/alerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import { Plus, Pencil, Trash2, Settings } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Lab {
    id: number;
    name: string;
}

export default function AlertRules() {
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
    const { toast } = useToast();

    const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Partial<AlertRule>>();
    const watchType = watch('type');

    useEffect(() => {
        fetchRules();
        fetchLabs();
    }, []);

    useEffect(() => {
        if (editingRule) {
            reset(editingRule);
        } else {
            reset({
                type: 'metric',
                severity: 'warning',
                is_active: true,
                duration_minutes: 0,
                notification_channels: ['database'],
            });
        }
    }, [editingRule, isOpen]);

    const fetchRules = async () => {
        try {
            const { data } = await apiClient.get('/alert-rules');
            setRules(data.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchLabs = async () => {
        try {
            const { data } = await apiClient.get('/labs');
            setLabs(data.data || []);
        } catch (error) { }
    };

    const onSubmit = async (data: Partial<AlertRule>) => {
        try {
            // Fix types for numeric fields
            if (data.threshold) data.threshold = Number(data.threshold);
            if (data.duration_minutes) data.duration_minutes = Number(data.duration_minutes);
            
            if (editingRule) {
                await apiClient.put(`/alert-rules/${editingRule.id}`, data);
                toast({ title: 'Sucesso', description: 'Regra atualizada com sucesso.' });
            } else {
                await apiClient.post('/alert-rules', data);
                toast({ title: 'Sucesso', description: 'Regra criada com sucesso.' });
            }
            setIsOpen(false);
            setEditingRule(null);
            fetchRules();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await apiClient.delete(`/alert-rules/${id}`);
            toast({ title: 'Sucesso', description: 'Regra excluída.' });
            fetchRules();
        } catch (error) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Regras de Alerta</h2>
                <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setEditingRule(null); }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nova Regra</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Alerta'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome da Regra</Label>
                                <Input {...register('name', { required: true })} placeholder="Ex: CPU Alta" />
                                {errors.name && <span className="text-red-500 text-xs">Obrigatório</span>}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipo</Label>
                                    <Controller
                                        control={control}
                                        name="type"
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value || 'metric'}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="metric">Métrica (CPU/RAM)</SelectItem>
                                                    <SelectItem value="status">Status (Online/Offline)</SelectItem>
                                                    <SelectItem value="software">Software</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Severidade</Label>
                                    <Controller
                                        control={control}
                                        name="severity"
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value || 'warning'}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="info">Info</SelectItem>
                                                    <SelectItem value="warning">Alerta</SelectItem>
                                                    <SelectItem value="critical">Crítico</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            {watchType === 'metric' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Métrica</Label>
                                        <Controller
                                            control={control}
                                            name="metric"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cpu_usage">Uso de CPU (%)</SelectItem>
                                                        <SelectItem value="memory_usage">Uso de Memória (%)</SelectItem>
                                                        <SelectItem value="disk_usage">Uso de Disco (%)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Condição</Label>
                                        <Controller
                                            control={control}
                                            name="condition"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} defaultValue={field.value || '>'}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value=">">Maior que</SelectItem>
                                                        <SelectItem value=">=">Maior ou igual a</SelectItem>
                                                        <SelectItem value="<">Menor que</SelectItem>
                                                        <SelectItem value="<=">Menor ou igual a</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label>Valor Limite</Label>
                                        <Input type="number" step="0.1" {...register('threshold')} placeholder="Ex: 90" />
                                    </div>
                                </div>
                            )}

                            {watchType === 'status' && (
                                <div className="space-y-2">
                                    <Label>Condição</Label>
                                    <Controller
                                        control={control}
                                        name="metric"
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value || 'offline'}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="offline">Computador Offline</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Duração mínima (minutos)</Label>
                                <Input type="number" {...register('duration_minutes')} placeholder="0 para imediato" />
                                <span className="text-xs text-muted-foreground">Tempo que a condição deve persistir para gerar alerta.</span>
                            </div>

                            <div className="space-y-2">
                                <Label>Laboratório (Opcional)</Label>
                                <Controller
                                    control={control}
                                    name="lab_id"
                                    render={({ field }) => (
                                        <Select 
                                            onValueChange={(val) => field.onChange(val === 'all' ? null : Number(val))} 
                                            value={field.value ? String(field.value) : 'all'}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Todos os laboratórios" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos os laboratórios</SelectItem>
                                                {labs.map(lab => (
                                                    <SelectItem key={lab.id} value={String(lab.id)}>{lab.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Controller
                                    control={control}
                                    name="is_active"
                                    render={({ field }) => (
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    )}
                                />
                                <Label>Regra Ativa</Label>
                            </div>

                            <DialogFooter>
                                <Button type="submit">Salvar</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Regras Configuradas</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Condição</TableHead>
                                <TableHead>Escopo</TableHead>
                                <TableHead>Severidade</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rules.map((rule) => (
                                <TableRow key={rule.id}>
                                    <TableCell className="font-medium">{rule.name}</TableCell>
                                    <TableCell>
                                        {rule.type === 'metric' && `${rule.metric} ${rule.condition} ${rule.threshold}`}
                                        {rule.type === 'status' && `Status: ${rule.metric}`}
                                        {rule.duration_minutes ? ` (> ${rule.duration_minutes} min)` : ''}
                                    </TableCell>
                                    <TableCell>
                                        {rule.lab ? rule.lab.name : 'Global'}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`capitalize ${
                                            rule.severity === 'critical' ? 'text-red-600 font-bold' : 
                                            rule.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                                        }`}>
                                            {rule.severity}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {rule.is_active ? (
                                            <span className="text-green-600 flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-500" /> Ativo</span>
                                        ) : (
                                            <span className="text-gray-400 flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-gray-300" /> Inativo</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => { setEditingRule(rule); setIsOpen(true); }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir Regra?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta ação não pode ser desfeita.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(rule.id)} className="bg-red-600 hover:bg-red-700">
                                                            Excluir
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {rules.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                        Nenhuma regra configurada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
