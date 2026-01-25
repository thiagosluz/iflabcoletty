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
        Schema::create('computer_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('computer_id')->constrained()->cascadeOnDelete();

            $table->float('cpu_usage_percent')->nullable();

            $table->float('memory_usage_percent')->nullable();
            $table->float('memory_total_gb')->nullable();
            $table->float('memory_free_gb')->nullable();

            // Armazena detalhes de múltiplos discos/partições
            // Ex: [{"mount": "C:", "total_gb": 500, "free_gb": 100, "percent": 80}]
            $table->json('disk_usage')->nullable();

            // Armazena tráfego acumulado ou atual
            $table->json('network_stats')->nullable();

            $table->bigInteger('uptime_seconds')->nullable();
            $table->integer('processes_count')->nullable();

            $table->timestamp('recorded_at');
            $table->timestamps();

            // Índice para consultas de histórico e limpeza
            $table->index(['computer_id', 'recorded_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('computer_metrics');
    }
};
