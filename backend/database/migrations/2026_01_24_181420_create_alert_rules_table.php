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
        Schema::create('alert_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();

            // Tipo de regra: metric (CPU, RAM), status (Offline), software (Change)
            $table->string('type');

            // Detalhes da métrica (ex: 'cpu_usage', 'memory_usage', 'disk_usage')
            $table->string('metric')->nullable();

            // Condição: '>', '<', '=', '>=', '<=', 'change'
            $table->string('condition')->nullable();

            // Valor de limite (ex: 90.0 para 90%)
            $table->float('threshold')->nullable();

            // Duração necessária em minutos para disparar (ex: 5 minutos acima do limite)
            $table->integer('duration_minutes')->default(0);

            // Severidade: info, warning, critical
            $table->string('severity')->default('warning');

            // Escopo: Se null, aplica a todos. Se definido, aplica apenas ao laboratório
            $table->foreignId('lab_id')->nullable()->constrained()->nullOnDelete();

            // Canais de notificação (json array: ['database', 'email', 'webhook'])
            $table->json('notification_channels')->nullable();

            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alert_rules');
    }
};
