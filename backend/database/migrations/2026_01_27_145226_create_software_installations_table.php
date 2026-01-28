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
        Schema::create('software_installations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('computer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('software_name')->nullable();
            $table->enum('installer_type', ['upload', 'url', 'network']);
            $table->string('installer_path')->nullable(); // Para upload
            $table->string('installer_url')->nullable(); // Para URL
            $table->string('network_path')->nullable(); // Para network share
            $table->string('file_id')->nullable(); // ID do arquivo no storage
            $table->text('install_args')->nullable(); // Argumentos customizados
            $table->boolean('silent_mode')->default(true);
            $table->boolean('reboot_after')->default(false);
            $table->string('status')->default('pending'); // pending, processing, completed, failed
            $table->text('output')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['computer_id', 'status']);
            $table->index('user_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('software_installations');
    }
};
