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
            // Check if column doesn't exist before adding
            if (!Schema::hasColumn('computers', 'public_hash')) {
                $table->string('public_hash')->unique()->after('machine_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('computers', function (Blueprint $table) {
            if (Schema::hasColumn('computers', 'public_hash')) {
                $table->dropColumn('public_hash');
            }
        });
    }
};
