<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('software_installations', function (Blueprint $table) {
            if (! Schema::hasColumn('software_installations', 'command_id')) {
                $table->foreignId('command_id')->nullable()->after('computer_id')->constrained('computer_commands')->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('software_installations', function (Blueprint $table) {
            if (Schema::hasColumn('software_installations', 'command_id')) {
                $table->dropForeign(['command_id']);
            }
        });
    }
};
