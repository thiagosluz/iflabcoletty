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
        Schema::table('report_jobs', function (Blueprint $table) {
            if (! Schema::hasColumn('report_jobs', 'user_id')) {
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete()->after('id');
            }
            if (! Schema::hasColumn('report_jobs', 'type')) {
                $table->string('type')->after('user_id'); // 'labs', 'computers', 'softwares'
            }
            if (! Schema::hasColumn('report_jobs', 'format')) {
                $table->string('format')->after('type'); // 'pdf', 'csv', 'xlsx'
            }
            if (! Schema::hasColumn('report_jobs', 'filters')) {
                $table->json('filters')->nullable()->after('format'); // Store filter parameters
            }
            if (! Schema::hasColumn('report_jobs', 'status')) {
                $table->string('status')->default('pending')->after('filters'); // 'pending', 'processing', 'completed', 'failed'
            }
            if (! Schema::hasColumn('report_jobs', 'file_path')) {
                $table->string('file_path')->nullable()->after('status');
            }
            if (! Schema::hasColumn('report_jobs', 'error_message')) {
                $table->text('error_message')->nullable()->after('file_path');
            }
            if (! Schema::hasColumn('report_jobs', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('error_message');
            }
            if (! Schema::hasColumn('report_jobs', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('started_at');
            }
            if (! Schema::hasColumn('report_jobs', 'failed_at')) {
                $table->timestamp('failed_at')->nullable()->after('completed_at');
            }
        });

        // Add indexes
        Schema::table('report_jobs', function (Blueprint $table) {
            if (! $this->indexExists('report_jobs', 'report_jobs_status_index')) {
                $table->index('status', 'report_jobs_status_index');
            }
            if (! $this->indexExists('report_jobs', 'report_jobs_user_id_index')) {
                $table->index('user_id', 'report_jobs_user_id_index');
            }
            if (! $this->indexExists('report_jobs', 'report_jobs_created_at_index')) {
                $table->index('created_at', 'report_jobs_created_at_index');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('report_jobs', function (Blueprint $table) {
            if ($this->indexExists('report_jobs', 'report_jobs_status_index')) {
                $table->dropIndex('report_jobs_status_index');
            }
            if ($this->indexExists('report_jobs', 'report_jobs_user_id_index')) {
                $table->dropIndex('report_jobs_user_id_index');
            }
            if ($this->indexExists('report_jobs', 'report_jobs_created_at_index')) {
                $table->dropIndex('report_jobs_created_at_index');
            }

            $table->dropColumn([
                'user_id',
                'type',
                'format',
                'filters',
                'status',
                'file_path',
                'error_message',
                'started_at',
                'completed_at',
                'failed_at',
            ]);
        });
    }

    /**
     * Check if an index exists on a table
     */
    private function indexExists(string $table, string $index): bool
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if ($driver === 'sqlite') {
            $result = $connection->selectOne(
                "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND tbl_name=? AND name=?",
                [$table, $index]
            );

            return $result->count > 0;
        }

        if ($driver === 'pgsql') {
            $result = $connection->selectOne(
                'SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = ? AND indexname = ?',
                [$table, $index]
            );

            return $result->count > 0;
        }

        // MySQL/MariaDB
        $databaseName = $connection->getDatabaseName();
        $result = $connection->selectOne(
            'SELECT COUNT(*) as count FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
            [$databaseName, $table, $index]
        );

        return $result->count > 0;
    }
};
