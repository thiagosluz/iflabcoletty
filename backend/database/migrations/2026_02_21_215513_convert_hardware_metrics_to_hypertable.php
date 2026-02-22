<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * O TimescaleDB pode não suportar create_hypertable dentro de transações de DDL em certas versões.
     * Desabilitamos o wrapping de transaction padrão do Laravel para essa migration.
     */
    public $withinTransaction = false;

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Garante que a extensão do TimescaleDB exista e esteja habilitada
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE EXTENSION IF NOT EXISTS timescaledb;');

            // O TimescaleDB requer que, se houver Primary Key, a coluna de particionamento (tempo)
            // faça parte dessa chave. Como nossa tabela tem 'id' apenas e o Laravel já criou
            // primary key(id), precisamos dropar a constraint para permitir a conversão fluida
            // ou recriar a chave composta. Por simplicidade e máxima performance em append-only,
            // removemos a constraint de PK do ID.
            DB::statement('ALTER TABLE computer_metrics DROP CONSTRAINT IF EXISTS computer_metrics_pkey;');

            // Converte a tabela existente para uma Hypertable particionada pela coluna `recorded_at`
            // migrate_data => true garante que os dados pré-existentes virem chunks particionados
            DB::statement("SELECT create_hypertable('computer_metrics', 'recorded_at', migrate_data => true);");

            // (Opcional) Podemos criar uma política de retenção para excluir dados maiores que 6 meses
            // DB::statement("SELECT add_retention_policy('computer_metrics', INTERVAL '6 months');");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            // Reverter uma Hypertable para tabela comum não é algo simples ou feito em uma linha
            // pelo Timescale (pois envolve mesclar muitos chunks físicos).
            // Em caso de Rollback severo da extensão, as tabelas são droppadas.
            // Para efeitos dessa migration focamos apenas no setup inicial.
        }
    }
};
