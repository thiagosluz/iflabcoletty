<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Criar permissões
        $permissions = [
            // Labs
            'labs.view',
            'labs.create',
            'labs.update',
            'labs.delete',

            // Computers
            'computers.view',
            'computers.create',
            'computers.update',
            'computers.delete',

            // Softwares
            'softwares.view',
            'softwares.create',
            'softwares.update',
            'softwares.delete',

            // Dashboard
            'dashboard.view',
            'system-health.view',

            // Reports
            'reports.view',
            'reports.create',
            'reports.download',

            // Audit Logs
            'audit-logs.view',

            // Backups
            'backups.view',
            'backups.create',
            'backups.delete',
            'backups.restore',

            // Users
            'users.view',
            'users.create',
            'users.update',
            'users.delete',

            // Roles
            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',

            // Notifications
            'notifications.view',
            'notifications.update',
            'notifications.delete',

            // Alerts
            'alerts.view',
            'alerts.resolve',

            // Alert Rules
            'alert-rules.view',
            'alert-rules.create',
            'alert-rules.update',
            'alert-rules.delete',

            // Remote Control
            'remote-control.view',
            'remote-control.execute',

            // Scheduled Tasks (Automation)
            'scheduled-tasks.view',
            'scheduled-tasks.create',
            'scheduled-tasks.update',
            'scheduled-tasks.delete',

            // Software Installations
            'software-installations.view',
            'software-installations.create',
            'software-installations.delete',
        ];

        // Criar permissões com guard_name explícito
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(
                ['name' => $permission, 'guard_name' => 'web']
            );
        }

        // Criar roles com guard_name explícito
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $technicianRole = Role::firstOrCreate(['name' => 'technician', 'guard_name' => 'web']);
        $professorRole = Role::firstOrCreate(['name' => 'professor', 'guard_name' => 'web']);
        $viewerRole = Role::firstOrCreate(['name' => 'viewer', 'guard_name' => 'web']);

        // Atribuir todas as permissões ao admin
        $adminRole->givePermissionTo(Permission::all());

        // Permissões para técnico (pode gerenciar tudo exceto usuários e roles)
        $technicianRole->givePermissionTo([
            'labs.view',
            'labs.create',
            'labs.update',
            'labs.delete',
            'computers.view',
            'computers.create',
            'computers.update',
            'computers.delete',
            'softwares.view',
            'softwares.create',
            'softwares.update',
            'softwares.delete',
            'dashboard.view',
            'system-health.view',
            'reports.view',
            'reports.create',
            'reports.download',
            'audit-logs.view',
            'backups.view',
            'backups.create',
            'backups.delete',
            'backups.restore',
            'notifications.view',
            'notifications.update',
            'alerts.view',
            'alerts.resolve',
            'alert-rules.view',
            'alert-rules.create',
            'alert-rules.update',
            'alert-rules.delete',
            'remote-control.view',
            'remote-control.execute',
            'scheduled-tasks.view',
            'scheduled-tasks.create',
            'scheduled-tasks.update',
            'scheduled-tasks.delete',
            'software-installations.view',
            'software-installations.create',
            'software-installations.delete',
        ]);

        // Permissões para professor (pode visualizar e criar relatórios)
        $professorRole->givePermissionTo([
            'labs.view',
            'computers.view',
            'softwares.view',
            'dashboard.view',
            'reports.view',
            'reports.create',
            'reports.download',
            'notifications.view',
            'notifications.update',
            'notifications.delete',
            'alerts.view', // Apenas visualizar alertas
        ]);

        // Permissões para visualizador (apenas visualização)
        $viewerRole->givePermissionTo([
            'labs.view',
            'computers.view',
            'softwares.view',
            'dashboard.view',
            'reports.view',
            'notifications.view',
            'notifications.update',
            'notifications.delete',
        ]);

        // Atribuir role admin ao usuário admin existente (se existir)
        $adminUser = User::where('email', 'admin@iflab.com')->first();
        if ($adminUser && ! $adminUser->hasRole('admin')) {
            $adminUser->assignRole('admin');
        }

        if ($this->command) {
            $this->command->info('Roles e permissions criados com sucesso!');
            $this->command->info('Roles: admin, technician, professor, viewer');
            $this->command->info('Total de permissions: '.Permission::count());
        }
    }
}
