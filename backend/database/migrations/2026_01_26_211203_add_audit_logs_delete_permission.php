<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $permission = \Spatie\Permission\Models\Permission::create(['name' => 'audit-logs.delete', 'guard_name' => 'web']);
        $role = \Spatie\Permission\Models\Role::where('name', 'admin')->first();
        if ($role) {
            $role->givePermissionTo($permission);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $role = \Spatie\Permission\Models\Role::where('name', 'admin')->first();
        if ($role) {
            $role->revokePermissionTo('audit-logs.delete');
        }
        \Spatie\Permission\Models\Permission::where('name', 'audit-logs.delete')->delete();
    }
};
