import { useState, useEffect, useCallback } from 'react';
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
import { MoreHorizontal, Plus, Trash2, Edit, Shield } from 'lucide-react';
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

interface Role {
    id: number;
    name: string;
    permissions?: Array<{ id: number; name: string }>;
}

interface Permission {
    id: number;
    name: string;
}

const roleSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    permissions: z.array(z.string()).optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function Roles() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<RoleFormData>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            permissions: [],
        },
    });

    const selectedPermissions = watch('permissions') || [];

    const fetchPermissions = useCallback(async () => {
        try {
            const response = await apiClient.get('/permissions');
            setPermissions(response.data || []);
        } catch (error: unknown) {
            console.error('Erro ao carregar permissions:', error);
        }
    }, []);

    const fetchRoles = useCallback(async () => {
        try {
            const response = await apiClient.get('/roles');
            setRoles(response.data || []);
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        }
    }, [toast]);

    useEffect(() => {
        fetchRoles();
        fetchPermissions();
    }, [fetchRoles, fetchPermissions]);

    const onSubmit = async (data: RoleFormData) => {
        try {
            // Remove permissions if empty array
            const payload: Record<string, unknown> = { ...data };
            if (!payload.permissions || (Array.isArray(payload.permissions) && payload.permissions.length === 0)) {
                delete payload.permissions;
            }

            if (editingRole) {
                await apiClient.put(`/roles/${editingRole.id}`, payload);
                toast({ title: 'Sucesso', description: 'Role atualizada com sucesso' });
            } else {
                await apiClient.post('/roles', payload);
                toast({ title: 'Sucesso', description: 'Role criada com sucesso' });
            }
            setIsOpen(false);
            setIsEditOpen(false);
            setEditingRole(null);
            reset();
            fetchRoles();
        } catch (error: unknown) {
            const ax = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Erro',
                description: ax.response?.data?.message ?? 'Falha ao salvar role',
                variant: 'destructive'
            });
        }
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setValue('name', role.name);
        setValue('permissions', role.permissions?.map(p => p.name) || []);
        setIsEditOpen(true);
    };

    const handleDelete = async () => {
        if (!roleToDelete) return;

        try {
            setIsDeleting(true);
            await apiClient.delete(`/roles/${roleToDelete.id}`);
            toast({ title: 'Excluído', description: 'Role excluída com sucesso' });
            fetchRoles();
            setRoleToDelete(null);
        } catch (error: unknown) {
            toast({ ...getApiErrorToast(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const togglePermission = (permissionName: string) => {
        const currentPermissions = selectedPermissions;
        if (currentPermissions.includes(permissionName)) {
            setValue('permissions', currentPermissions.filter(p => p !== permissionName));
        } else {
            setValue('permissions', [...currentPermissions, permissionName]);
        }
    };

    // Group permissions by resource
    const groupedPermissions = permissions.reduce((acc, permission) => {
        const [resource] = permission.name.split('.');
        if (!acc[resource]) {
            acc[resource] = [];
        }
        acc[resource].push(permission);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Roles e Permissions</h2>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Adicionar Role</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Criar Nova Role</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input {...register('name')} placeholder="ex: manager" />
                                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Permissions</Label>
                                <div className="space-y-4 max-h-96 overflow-y-auto border rounded p-4">
                                    {Object.entries(groupedPermissions).map(([resource, perms]) => (
                                        <div key={resource} className="space-y-2">
                                            <h4 className="font-semibold text-sm uppercase text-gray-600">{resource}</h4>
                                            <div className="grid grid-cols-2 gap-2 ml-4">
                                                {perms.map((permission) => (
                                                    <div key={permission.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`perm-${permission.id}`}
                                                            checked={selectedPermissions.includes(permission.name)}
                                                            onCheckedChange={() => togglePermission(permission.name)}
                                                        />
                                                        <label
                                                            htmlFor={`perm-${permission.id}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                        >
                                                            {permission.name.split('.')[1] || permission.name}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Button type="submit" disabled={isSubmitting}>Criar</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {roles.map((role) => (
                            <TableRow key={role.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-gray-400" />
                                        {role.name}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-1 flex-wrap">
                                        {role.permissions?.map((permission) => (
                                            <Badge key={permission.id} variant="outline" className="text-xs">
                                                {permission.name}
                                            </Badge>
                                        ))}
                                        {(!role.permissions || role.permissions.length === 0) && (
                                            <span className="text-gray-400 text-sm">Sem permissions</span>
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
                                            <DropdownMenuItem onClick={() => handleEdit(role)}>
                                                <Edit className="mr-2 h-4 w-4" /> Editar
                                            </DropdownMenuItem>
                                            {!['admin', 'technician', 'professor', 'viewer'].includes(role.name) && (
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onSelect={(e) => {
                                                        e.preventDefault();
                                                        setRoleToDelete(role);
                                                    }}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {roles.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24">Nenhuma role encontrada.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Role</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input {...register('name')} disabled={editingRole?.name === 'admin'} />
                            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                            {editingRole?.name === 'admin' && (
                                <p className="text-sm text-amber-600">O nome da role admin não pode ser alterado</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Permissions</Label>
                            {editingRole?.name === 'admin' ? (
                                <p className="text-sm text-amber-600">As permissions da role admin não podem ser alteradas</p>
                            ) : (
                                <div className="space-y-4 max-h-96 overflow-y-auto border rounded p-4">
                                    {Object.entries(groupedPermissions).map(([resource, perms]) => (
                                        <div key={resource} className="space-y-2">
                                            <h4 className="font-semibold text-sm uppercase text-gray-600">{resource}</h4>
                                            <div className="grid grid-cols-2 gap-2 ml-4">
                                                {perms.map((permission) => (
                                                    <div key={permission.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`edit-perm-${permission.id}`}
                                                            checked={selectedPermissions.includes(permission.name)}
                                                            onCheckedChange={() => togglePermission(permission.name)}
                                                        />
                                                        <label
                                                            htmlFor={`edit-perm-${permission.id}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                        >
                                                            {permission.name.split('.')[1] || permission.name}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button type="submit" disabled={isSubmitting || editingRole?.name === 'admin'}>Salvar</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={roleToDelete !== null} onOpenChange={(open) => !open && setRoleToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a role <strong>{roleToDelete?.name}</strong>?
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
