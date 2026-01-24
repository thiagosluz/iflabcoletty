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
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_rule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('computer_id')->constrained()->cascadeOnDelete();
            
            $table->string('title');
            $table->text('description');
            
            // Severidade no momento do disparo (pode ter mudado na regra depois)
            $table->string('severity'); // info, warning, critical
            
            // Status: active, resolved, acknowledged
            $table->string('status')->default('active');
            
            $table->timestamp('resolved_at')->nullable();
            
            // Valor que disparou o alerta (ex: 95.5)
            $table->float('trigger_value')->nullable();
            
            $table->timestamps();
            
            // Índices para performance
            $table->index(['status', 'severity']);
            $table->index('computer_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
