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
        Schema::create('scheduled_tasks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('command', ['shutdown', 'restart', 'lock', 'logoff', 'message', 'wol']);
            $table->string('target_type'); // 'App\Models\Lab' or 'App\Models\Computer'
            $table->unsignedBigInteger('target_id');
            $table->enum('frequency', ['daily', 'weekly', 'monthly', 'once']);
            $table->time('time'); // 22:00
            $table->json('days_of_week')->nullable(); // [1, 3, 5] for Mon, Wed, Fri
            $table->date('run_at_date')->nullable(); // For 'once' frequency
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->unsignedBigInteger('user_id'); // Creator
            $table->timestamps();

            $table->index(['target_type', 'target_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scheduled_tasks');
    }
};
