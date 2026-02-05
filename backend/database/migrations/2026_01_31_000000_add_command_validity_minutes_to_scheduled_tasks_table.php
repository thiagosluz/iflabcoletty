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
        Schema::table('scheduled_tasks', function (Blueprint $table) {
            $table->unsignedSmallInteger('command_validity_minutes')->nullable()->after('time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('scheduled_tasks', function (Blueprint $table) {
            $table->dropColumn('command_validity_minutes');
        });
    }
};
