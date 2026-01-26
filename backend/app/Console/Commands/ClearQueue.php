<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class ClearQueue extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'queue:clear-all 
                            {--queue= : Nome da fila específica (default, high, low)}
                            {--failed : Limpar apenas jobs falhados}
                            {--pending : Limpar apenas jobs pendentes}
                            {--force : Forçar limpeza sem confirmação}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Limpar jobs pendentes e/ou falhados da fila Redis';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $connection = config('queue.default', 'sync');

        if ($connection !== 'redis') {
            $this->error("Este comando só funciona com Redis. Conexão atual: {$connection}");

            return Command::FAILURE;
        }

        $queue = $this->option('queue') ?: config('queue.connections.redis.queue', 'default');
        $clearFailed = $this->option('failed');
        $clearPending = $this->option('pending');
        $force = $this->option('force');

        // Se nenhuma opção específica foi fornecida, limpar tudo
        if (! $clearFailed && ! $clearPending) {
            $clearFailed = true;
            $clearPending = true;
        }

        try {
            // Get Redis connection - try different methods
            try {
                $redis = Redis::connection();
            } catch (\Exception $e) {
                // Fallback to app helper
                $redis = app('redis')->connection();
            }

            // Verificar status atual
            $this->info('=== Status Atual da Fila ===');

            if ($clearPending) {
                $pendingCount = $redis->llen("queues:{$queue}");
                $this->info("Jobs pendentes na fila '{$queue}': {$pendingCount}");
            }

            if ($clearFailed) {
                $failedCount = DB::table('failed_jobs')->count();
                $this->info("Jobs falhados no banco: {$failedCount}");
            }

            // Confirmar antes de limpar
            if (! $force) {
                $confirmMessage = 'Tem certeza que deseja limpar ';
                if ($clearPending && $clearFailed) {
                    $confirmMessage .= 'todos os jobs pendentes e falhados';
                } elseif ($clearPending) {
                    $confirmMessage .= 'todos os jobs pendentes';
                } else {
                    $confirmMessage .= 'todos os jobs falhados';
                }
                $confirmMessage .= '? (yes/no)';

                if (! $this->confirm($confirmMessage, false)) {
                    $this->info('Operação cancelada.');

                    return Command::SUCCESS;
                }
            }

            // Limpar jobs pendentes
            if ($clearPending) {
                $this->info("\n=== Limpando Jobs Pendentes ===");

                // Limpar fila específica (múltiplos formatos)
                $queueKeys = [
                    "queues:{$queue}",
                    "queues:{$queue}:notify",
                ];

                foreach ($queueKeys as $queueKey) {
                    try {
                        $count = $redis->llen($queueKey);
                        if ($count > 0) {
                            $deleted = $redis->del($queueKey);
                            if ($deleted > 0) {
                                $this->info("✓ Fila '{$queueKey}' limpa ({$count} jobs removidos)");
                            } else {
                                $this->warn("⚠ Não foi possível deletar a fila '{$queueKey}'");
                            }
                        } else {
                            $this->comment("  Fila '{$queueKey}' já está vazia");
                        }
                    } catch (\Exception $e) {
                        $this->error("  Erro ao limpar fila '{$queueKey}': ".$e->getMessage());
                    }
                }

                // Limpar outras filas comuns se não foi especificada
                if (! $this->option('queue')) {
                    $otherQueues = ['high', 'low'];
                    foreach ($otherQueues as $otherQueue) {
                        $otherQueueKeys = [
                            "queues:{$otherQueue}",
                            "queues:{$otherQueue}:notify",
                        ];

                        foreach ($otherQueueKeys as $queueKey) {
                            $count = $redis->llen($queueKey);
                            if ($count > 0) {
                                $redis->del($queueKey);
                                $this->info("✓ Fila '{$queueKey}' limpa ({$count} jobs removidos)");
                            }
                        }
                    }
                }

                // Limpar jobs reservados (que podem estar travados)
                $reservedPatterns = [
                    "queues:{$queue}:reserved",
                ];

                foreach ($reservedPatterns as $pattern) {
                    $reservedKeys = $redis->keys($pattern);
                    if (! empty($reservedKeys)) {
                        foreach ($reservedKeys as $key) {
                            $redis->del($key);
                        }
                        $this->info("✓ Jobs reservados limpos (padrão: {$pattern})");
                    }
                }
            }

            // Limpar jobs falhados
            if ($clearFailed) {
                $this->info("\n=== Limpando Jobs Falhados ===");
                $failedCount = DB::table('failed_jobs')->count();

                if ($failedCount > 0) {
                    DB::table('failed_jobs')->truncate();
                    $this->info("✓ {$failedCount} jobs falhados removidos do banco de dados");
                } else {
                    $this->info('✓ Nenhum job falhado encontrado');
                }
            }

            // Verificar status final
            $this->info("\n=== Status Final ===");
            if ($clearPending) {
                $finalPending = $redis->llen("queues:{$queue}");
                $this->info("Jobs pendentes na fila '{$queue}': {$finalPending}");
            }
            if ($clearFailed) {
                $finalFailed = DB::table('failed_jobs')->count();
                $this->info("Jobs falhados no banco: {$finalFailed}");
            }

            $this->info("\n✓ Limpeza concluída com sucesso!");

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Erro ao limpar fila: '.$e->getMessage());

            return Command::FAILURE;
        }
    }
}
