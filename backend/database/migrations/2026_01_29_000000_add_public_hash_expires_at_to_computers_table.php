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
            if (! Schema::hasColumn('computers', 'public_hash_expires_at')) {
                $table->timestamp('public_hash_expires_at')->nullable()->after('public_hash');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('computers', function (Blueprint $table) {
            if (Schema::hasColumn('computers', 'public_hash_expires_at')) {
                $table->dropColumn('public_hash_expires_at');
            }
        });
    }
};
