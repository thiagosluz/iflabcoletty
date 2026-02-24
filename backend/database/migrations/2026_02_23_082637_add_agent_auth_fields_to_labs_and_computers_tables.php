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
        Schema::table('labs', function (Blueprint $table) {
            $table->string('installation_token')->nullable()->after('updated_at');
        });

        Schema::table('computers', function (Blueprint $table) {
            $table->string('agent_api_key')->nullable()->unique()->after('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('computers', function (Blueprint $table) {
            $table->dropColumn('agent_api_key');
        });

        Schema::table('labs', function (Blueprint $table) {
            $table->dropColumn('installation_token');
        });
    }
};
