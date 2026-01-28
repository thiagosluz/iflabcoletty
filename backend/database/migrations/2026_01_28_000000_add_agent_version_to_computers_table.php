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
        Schema::table('computers', function (Blueprint $table) {
            if (! Schema::hasColumn('computers', 'agent_version')) {
                $table->string('agent_version')->nullable()->after('hostname');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('computers', function (Blueprint $table) {
            if (Schema::hasColumn('computers', 'agent_version')) {
                $table->dropColumn('agent_version');
            }
        });
    }
};
