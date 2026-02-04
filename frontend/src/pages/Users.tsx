import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorToast } from '@/lib/apiError';
import { MoreHorizontal, Plus, ChevronLeft, ChevronRight, Trash2, Edit, Shield } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface User {
    id: number;
    name: string;
    email: string;
    roles?: Array<{ id: number; name: string }>;
}

interface Role {
    id: number;
    name: string;
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

const userSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').optional().or(z.literal('')),
    roles: z.array(z.string()).optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function Users() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [search, setSearch] = useState('');
    const { toast } = useToast();

    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            roles: [],
        },
    });

    const selectedRoles = watch('roles') || [];

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('per_page', perPage.toString());
            if (search) {
                params.append('search', search);
            }

            const response = await apiClient.get(`/users?${params.toString()}`);
            setUsers(response.data.data || []);
            setPagination({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                per_page: response.data.per_page || perPage,
                total: response.data.total || 0,
                from: response.data.from || 0,
                to: response.data.to || 0,
            });
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.response?.data?.message || 'Falha ao carregar usuários',
                variant: 'destructive'
            });
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await apiClient.get('/roles');
            setRoles(response.data || []);
        } catch (error: any) {
            console.error('Erro ao carregar roles:', error);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [currentPage, perPage, search]);

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1);
    };

    const handleSearch = (value: string) => {
        setSearch(value);
        setCurrentPage(1);
    };

    const onSubmit = async (data: UserFormData) => {
        try {
            // Remove password if empty (for updates)
            const payload: any = { ...data };
            if (editingUser && (!payload.password || payload.password === '')) {
                delete payload.password;
            }
            
            // Remove roles if empty array
            if (!payload.roles || payload.roles.length === 0) {
                delete payload.roles;
            }
            
            if (editingUser) {
                await apiClient.put(`/users/${editingUser.id}`, payload);
                toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso' });
            } else {
                await apiClient.post('/users', payload);
                toast({ title: 'Sucesso', description: 'Usuário criado com sucesso' });
            }
            setIsOpen(false);
            setIsEditOpen(false);
            setEditingUser(null);
            reset();
            fetchUsers();
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setValue('name', user.name);
        setValue('email', user.email);
        setValue('roles', user.roles?.map(r => r.name) || []);
        setIsEditOpen(true);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        
        try {
            setIsDeleting(true);
            await apiClient.delete(`/users/${userToDelete.id}`);
            toast({ title: 'Excluído', description: 'Usuário excluído com sucesso' });
            
            const currentUsersCount = users.length;
            if (pagination && currentUsersCount === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
            } else {
                fetchUsers();
            }
            
            setUserToDelete(null);
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleRole = (roleName: string) => {
        const currentRoles = selectedRoles;
        if (currentRoles.includes(roleName)) {
            setValue('roles', currentRoles.filter(r => r !== roleName));
        } else {
            setValue('roles', [...currentRoles, roleName]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Usuários</h2>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-white shadow rounded-lg px-4 py-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Itens por página:</label>
                        <select
                            value={perPage.toString()}
                            onChange={(e) => handlePerPageChange(e.target.value)}
                            className="border rounded px-2 py-1"
                        >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> Adicionar Usuário</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Criar Novo Usuário</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome</Label>
                                    <Input {...register('name')} placeholder="João Silva" />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input type="email" {...register('email')} placeholder="joao@example.com" />
                                    {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Senha</Label>
                                    <Input type="password" {...register('password')} placeholder="Mínimo 8 caracteres" />
                                    {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Roles</Label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                                        {roles.map((role) => (
                                            <div key={role.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`role-${role.id}`}
                                                    checked={selectedRoles.includes(role.name)}
                                                    onCheckedChange={() => toggleRole(role.name)}
                                                />
                                                <label
                                                    htmlFor={`role-${role.id}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {role.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button type="submit" disabled={isSubmitting}>Criar</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
                <Input
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <div className="flex gap-1 flex-wrap">
                                        {user.roles?.map((role) => (
                                            <Badge key={role.id} variant="secondary">
                                                {role.name}
                                            </Badge>
                                        ))}
                                        {(!user.roles || user.roles.length === 0) && (
                                            <span className="text-gray-400 text-sm">Sem roles</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                <Edit className="mr-2 h-4 w-4" /> Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600"
                                                onSelect={(e) => {
                                                    e.preventDefault();
                                                    setUserToDelete(user);
                                                }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">Nenhum usuário encontrado.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.last_page > 1 && (
                <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                            Mostrando {pagination.from} a {pagination.to} de {pagination.total} usuários
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                                    let pageNum;
                                    if (pagination.last_page <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= pagination.last_page - 2) {
                                        pageNum = pagination.last_page - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className="min-w-[40px]"
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(pagination.last_page, prev + 1))}
                                disabled={currentPage === pagination.last_page}
                            >
                                Próxima
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info when no pagination needed */}
            {pagination && pagination.last_page === 1 && (
                <div className="text-sm text-gray-500">
                    Mostrando {pagination.total} {pagination.total === 1 ? 'usuário' : 'usuários'}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input {...register('name')} />
                            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" {...register('email')} />
                            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Nova Senha (deixe em branco para manter a atual)</Label>
                            <Input type="password" {...register('password')} placeholder="Mínimo 8 caracteres" />
                            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Roles</Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                                {roles.map((role) => (
                                    <div key={role.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`edit-role-${role.id}`}
                                            checked={selectedRoles.includes(role.name)}
                                            onCheckedChange={() => toggleRole(role.name)}
                                        />
                                        <label
                                            htmlFor={`edit-role-${role.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {role.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Button type="submit" disabled={isSubmitting}>Salvar</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={userToDelete !== null} onOpenChange={(open) => !open && setUserToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong> ({userToDelete?.email})?
                            <br />
                            <span className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {isDeleting ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    Excluindo...
                                </>
                            ) : (
                                'Excluir'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
