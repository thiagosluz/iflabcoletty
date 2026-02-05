import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label"
import {
    Trash2,
    Plus,
    Power,
    RotateCw,
    Lock,
    LogOut,
    MessageSquare,
    FileText,
    Check,
    ChevronsUpDown
} from 'lucide-react';

interface ScheduledTask {
    id: number;
    name: string;
    command: 'shutdown' | 'restart' | 'lock' | 'logoff' | 'message' | 'wol';
    target_type: 'App\\Models\\Lab' | 'App\\Models\\Computer';
    target_id: number;
    frequency: 'daily' | 'weekly' | 'monthly' | 'once';
    time: string;
    days_of_week: number[] | null;
    run_at_date: string | null;
    is_active: boolean;
    last_run_at: string | null;
    last_run_status?: 'success' | 'failed' | null;
    last_run_output?: string | null;
}

interface Lab {
    id: number;
    name: string;
}

export default function Schedules() {
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [labs, setLabs] = useState<Lab[]>([]);
    const [computers, setComputers] = useState<{ id: number; hostname: string }[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<ScheduledTask | null>(null);
    const [executingTaskId, setExecutingTaskId] = useState<number | null>(null);
    const [viewingTaskOutput, setViewingTaskOutput] = useState<ScheduledTask | null>(null);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [computerSearch, setComputerSearch] = useState("");
    const { toast } = useToast();

    // Form State
    // ... existing state ...

    // ... useEffect ...

    // ... fetchTasks ...

    const handleExecute = async (task: ScheduledTask) => {
        setExecutingTaskId(task.id);
        try {
            await apiClient.post(`/scheduled-tasks/${task.id}/execute`);
            toast({ title: 'Tarefa executada com sucesso' });
            fetchTasks(); // Refresh to show updated status
        } catch (error) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setExecutingTaskId(null);
        }
    };

    const handleEdit = (task: ScheduledTask) => {
        setEditingTask(task);
        setFormData({
            name: task.name,
            command: task.command,
            target_type: task.target_type === 'App\\Models\\Lab' ? 'lab' : 'computer',
            target_id: task.target_id.toString(),
            frequency: task.frequency,
            time: task.time,
            days_of_week: task.days_of_week || [],
            run_at_date: task.run_at_date || '',
            is_active: task.is_active
        });
        setIsDialogOpen(true);
    };
    const [formData, setFormData] = useState({
        name: '',
        command: 'shutdown',
        target_type: 'lab',
        target_id: '',
        frequency: 'daily',
        time: '22:00',
        days_of_week: [] as number[],
        run_at_date: '',
        is_active: true
    });

    useEffect(() => {
        fetchTasks();
        fetchLabs();
        fetchComputers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; fetches defined below
    }, []);

    // Debounce search for computers
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchComputers(computerSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [computerSearch]);

    const fetchTasks = async () => {
        try {
            const response = await apiClient.get('/scheduled-tasks');
            console.log('Tasks response:', response.data);
            const taskData = response.data.data ? response.data.data : response.data;
            setTasks(Array.isArray(taskData) ? taskData : []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            toast({ ...getApiErrorToast(error) });
        }
    };

    const fetchLabs = async () => {
        try {
            const response = await apiClient.get('/labs');
            console.log('Labs response:', response.data);
            // Handle both paginated and non-paginated responses
            const labsData = response.data.data ? response.data.data : response.data;
            setLabs(Array.isArray(labsData) ? labsData : []);
        } catch (error) {
            console.error('Error fetching labs:', error);
        }
    };

    const fetchComputers = async (search = "") => {
        try {
            // Fetch all computers for selection with search support
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('per_page', '20'); // Limit to 20 for dropdown

            const response = await apiClient.get(`/computers?${params.toString()}`);
            const computerData = response.data.data ? response.data.data : response.data;
            setComputers(Array.isArray(computerData) ? computerData : []);
        } catch (error) {
            console.error('Error fetching computers:', error);
        }
    };

    const handleSubmit = async () => {
        try {
            const payload = {
                ...formData,
                target_id: parseInt(formData.target_id)
            };

            if (editingTask) {
                await apiClient.put(`/scheduled-tasks/${editingTask.id}`, payload);
                toast({ title: 'Tarefa atualizada com sucesso' });
            } else {
                await apiClient.post('/scheduled-tasks', payload);
                toast({ title: 'Tarefa criada com sucesso' });
            }

            setIsDialogOpen(false);
            setTimeout(() => fetchTasks(), 100);
            resetForm();
        } catch (error) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const confirmDelete = (task: ScheduledTask) => {
        setTaskToDelete(task);
    };

    const executeDelete = async () => {
        if (!taskToDelete) return;

        try {
            await apiClient.delete(`/scheduled-tasks/${taskToDelete.id}`);
            toast({ title: 'Tarefa excluída' });
            fetchTasks();
        } catch (error) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setTaskToDelete(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            command: 'shutdown',
            target_type: 'lab',
            target_id: '',
            frequency: 'daily',
            time: '22:00',
            days_of_week: [],
            run_at_date: '',
            is_active: true
        });
        setEditingTask(null);
    };

    const getCommandIcon = (cmd: string) => {
        switch (cmd) {
            case 'shutdown': return <Power className="h-4 w-4 text-red-500" />;
            case 'restart': return <RotateCw className="h-4 w-4 text-orange-500" />;
            case 'lock': return <Lock className="h-4 w-4 text-yellow-500" />;
            case 'logoff': return <LogOut className="h-4 w-4 text-gray-500" />;
            default: return <MessageSquare className="h-4 w-4 text-blue-500" />;
        }
    };

    const getFrequencyLabel = (freq: string, days: number[] | null, date: string | null) => {
        if (freq === 'daily') return 'Diariamente';
        if (freq === 'once') return `Uma vez em ${date}`;
        if (freq === 'weekly') {
            const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            if (Array.isArray(days)) {
                return 'Semanal: ' + days.map(d => daysMap[d]).join(', ');
            }
            return 'Semanal:';
        }
        return freq;
    };

    const getStatusBadge = (task: ScheduledTask) => {
        if (!task.last_run_status) return <span className="text-gray-400">-</span>;

        return (
            <div className={`flex items-center gap-1 text-xs font-medium ${task.last_run_status === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                <span className={`w-2 h-2 rounded-full ${task.last_run_status === 'success' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                {task.last_run_status === 'success' ? 'Sucesso' : 'Falha'}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Automação e Agendamento</h1>
                    <p className="text-gray-500">Gerencie tarefas recorrentes para laboratórios.</p>
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Tarefa
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa Agendada'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome da Tarefa</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Desligamento Noturno Lab 1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="command">Comando</Label>
                                <Select
                                    value={formData.command}
                                    onValueChange={(val) => setFormData({ ...formData, command: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="shutdown">Desligar</SelectItem>
                                        <SelectItem value="restart">Reiniciar</SelectItem>
                                        <SelectItem value="lock">Bloquear</SelectItem>
                                        <SelectItem value="logoff">Fazer Logoff</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="target_type">Tipo de Alvo</Label>
                                <Select
                                    value={formData.target_type}
                                    onValueChange={(val) => setFormData({ ...formData, target_type: val, target_id: '' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lab">Laboratório</SelectItem>
                                        <SelectItem value="computer">Computador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="time">Horário</Label>
                            <Input
                                type="time"
                                value={formData.time}
                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="target">Alvo ({formData.target_type === 'lab' ? 'Laboratório' : 'Computador'})</Label>
                            {formData.target_type === 'lab' ? (
                                <Select
                                    value={formData.target_id}
                                    onValueChange={(val) => setFormData({ ...formData, target_id: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um laboratório" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {labs.map(lab => (
                                            <SelectItem key={lab.id} value={lab.id.toString()}>
                                                {lab.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="w-full justify-between"
                                        >
                                            {formData.target_id
                                                ? computers.find((computer) => computer.id.toString() === formData.target_id)?.hostname || "Computador selecionado"
                                                : "Selecione um computador..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0">
                                        <Command shouldFilter={false}>
                                            <CommandInput
                                                placeholder="Buscar computador..."
                                                value={computerSearch}
                                                onValueChange={setComputerSearch}
                                            />
                                            <CommandList>
                                                <CommandEmpty>Nenhum computador encontrado.</CommandEmpty>
                                                <CommandGroup>
                                                    {computers.map((computer) => (
                                                        <CommandItem
                                                            key={computer.id}
                                                            value={computer.id.toString()}
                                                            onSelect={(currentValue) => {
                                                                setFormData({ ...formData, target_id: currentValue === formData.target_id ? "" : currentValue })
                                                                setOpenCombobox(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    formData.target_id === computer.id.toString() ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {computer.hostname}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="frequency">Frequência</Label>
                            <Select
                                value={formData.frequency}
                                onValueChange={(val: string) => setFormData({ ...formData, frequency: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Diariamente</SelectItem>
                                    <SelectItem value="weekly">Semanalmente</SelectItem>
                                    <SelectItem value="once">Uma vez</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.frequency === 'weekly' && (
                            <div className="grid gap-2">
                                <Label>Dias da Semana</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                                        <Button
                                            key={idx}
                                            type="button"
                                            size="sm"
                                            variant={formData.days_of_week.includes(idx) ? 'default' : 'outline'}
                                            onClick={() => {
                                                const days = formData.days_of_week.includes(idx)
                                                    ? formData.days_of_week.filter(d => d !== idx)
                                                    : [...formData.days_of_week, idx];
                                                setFormData({ ...formData, days_of_week: days });
                                            }}
                                            className="w-8 h-8 p-0"
                                        >
                                            {day}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.frequency === 'once' && (
                            <div className="grid gap-2">
                                <Label htmlFor="date">Data</Label>
                                <Input
                                    type="date"
                                    value={formData.run_at_date}
                                    onChange={(e) => setFormData({ ...formData, run_at_date: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Tarefa</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a tarefa "{taskToDelete?.name}"? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Comando</TableHead>
                            <TableHead>Alvo</TableHead>
                            <TableHead>Frequência</TableHead>
                            <TableHead>Horário</TableHead>
                            <TableHead>Última Execução</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                    Nenhuma tarefa agendada encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            tasks.map((task) => (
                                <TableRow key={task.id}>
                                    <TableCell className="font-medium">{task.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getCommandIcon(task.command)}
                                            <span className="capitalize">{task.command}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {task.target_type.includes('Lab') ? 'Laboratório' : 'Computador'} #{task.target_id}
                                    </TableCell>
                                    <TableCell>
                                        {getFrequencyLabel(task.frequency, task.days_of_week, task.run_at_date)}
                                    </TableCell>
                                    <TableCell className="font-mono">{task.time.substring(0, 5)}</TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {task.last_run_at ? new Date(task.last_run_at).toLocaleString('pt-BR') : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(task)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleExecute(task)}
                                                disabled={executingTaskId === task.id}
                                                className={executingTaskId === task.id ? 'animate-pulse' : ''}
                                            >
                                                <Power className="h-4 w-4 text-green-600" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setViewingTaskOutput(task)}
                                                title="Ver logs de execução"
                                            >
                                                <FileText className="h-4 w-4 text-gray-600" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => handleEdit(task)}>
                                                <RotateCw className="h-4 w-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => confirmDelete(task)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={!!viewingTaskOutput} onOpenChange={(open) => !open && setViewingTaskOutput(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Detalhes da Execução - {viewingTaskOutput?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium mb-1">Status</h4>
                                <div className={`inline-flex items-center gap-1 text-sm font-medium ${viewingTaskOutput?.last_run_status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    <span className={`w-2 h-2 rounded-full ${viewingTaskOutput?.last_run_status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                                    {viewingTaskOutput?.last_run_status === 'success' ? 'Sucesso' : 'Falha'}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium mb-1">Data da Execução</h4>
                                <p className="text-sm text-gray-700">
                                    {viewingTaskOutput?.last_run_at ? new Date(viewingTaskOutput.last_run_at).toLocaleString('pt-BR') : '-'}
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium mb-1">Saída (Output)</h4>
                                <pre className="bg-slate-100 p-3 rounded-md text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[300px]">
                                    {viewingTaskOutput?.last_run_output || "Nenhuma saída registrada."}
                                </pre>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
