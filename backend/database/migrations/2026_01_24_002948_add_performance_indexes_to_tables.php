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
        // Computers table indexes
        Schema::table('computers', function (Blueprint $table) {
            // lab_id already has foreign key index, but add composite index for common queries
            $table->index(['lab_id', 'updated_at'], 'computers_lab_id_updated_at_index');
            $table->index(['lab_id', 'created_at'], 'computers_lab_id_created_at_index');

            // Index for status queries (online/offline based on updated_at)
            $table->index('updated_at', 'computers_updated_at_index');

            // Index for hostname searches (partial index would be better but not all DBs support)
            // Using regular index for LIKE queries (PostgreSQL can use it)
            $table->index('hostname', 'computers_hostname_index');
        });

        // Labs table indexes
        Schema::table('labs', function (Blueprint $table) {
            // name already has unique index, but add index for ordering
            // (unique index already serves this purpose, but keeping for clarity)
        });

        // Softwares table indexes
        Schema::table('softwares', function (Blueprint $table) {
            // Index for name ordering and searches
            $table->index('name', 'softwares_name_index');

            // Composite index for common search patterns
            $table->index(['name', 'version'], 'softwares_name_version_index');
        });

        // Computer_software pivot table indexes
        Schema::table('computer_software', function (Blueprint $table) {
            // These should already have indexes from foreign keys, but ensure they exist
            // Skip index check for SQLite (doesn't support information_schema queries the same way)
            $driver = \Illuminate\Support\Facades\DB::getDriverName();
            if ($driver !== 'sqlite') {
                if (! $this->hasIndex('computer_software', 'computer_software_computer_id_index')) {
                    $table->index('computer_id', 'computer_software_computer_id_index');
                }
                if (! $this->hasIndex('computer_software', 'computer_software_software_id_index')) {
                    $table->index('software_id', 'computer_software_software_id_index');
                }
            }
            // Composite index for common queries
            $table->index(['computer_id', 'software_id'], 'computer_software_composite_index');
        });

        // Computer_activities table indexes
        Schema::table('computer_activities', function (Blueprint $table) {
            // computer_id should have foreign key index, but add composite for common queries
            $table->index(['computer_id', 'created_at'], 'computer_activities_computer_created_index');

            // Index for ordering by created_at
            $table->index('created_at', 'computer_activities_created_at_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('computers', function (Blueprint $table) {
            $table->dropIndex('computers_lab_id_updated_at_index');
            $table->dropIndex('computers_lab_id_created_at_index');
            $table->dropIndex('computers_updated_at_index');
            $table->dropIndex('computers_hostname_index');
        });

        Schema::table('softwares', function (Blueprint $table) {
            $table->dropIndex('softwares_name_index');
            $table->dropIndex('softwares_name_version_index');
        });

        Schema::table('computer_software', function (Blueprint $table) {
            $table->dropIndex('computer_software_composite_index');
            // Don't drop individual indexes as they might be from foreign keys
        });

        Schema::table('computer_activities', function (Blueprint $table) {
            $table->dropIndex('computer_activities_computer_created_index');
            $table->dropIndex('computer_activities_created_at_index');
        });
    }

    /**
     * Check if an index exists on a table
     */
    private function hasIndex(string $table, string $index): bool
    {
        $connection = Schema::getConnection();
        $database = $connection->getDatabaseName();

        if ($connection->getDriverName() === 'pgsql') {
            $result = $connection->selectOne(
                'SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = ? AND indexname = ?',
                [$table, $index]
            );

            return $result->count > 0;
        }

        // For MySQL/MariaDB
        $result = $connection->selectOne(
            'SELECT COUNT(*) as count FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
            [$database, $table, $index]
        );

        return $result->count > 0;
    }
};
