<?php

namespace App\Console\Commands;

use App\Models\Computer;
use Illuminate\Console\Command;

class GeneratePublicHashes extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'computers:generate-hashes';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate public hashes for computers that don\'t have one';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Buscando computadores sem public_hash...');

        $computers = Computer::whereNull('public_hash')
            ->orWhere('public_hash', '')
            ->get();

        if ($computers->isEmpty()) {
            $this->info('✓ Todos os computadores já possuem public_hash.');
            return 0;
        }

        $this->info("Encontrados {$computers->count()} computador(es) sem public_hash.");
        
        $bar = $this->output->createProgressBar($computers->count());
        $bar->start();

        foreach ($computers as $computer) {
            $computer->public_hash = $computer->generatePublicHash();
            $computer->save();
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("✓ Hash gerado para {$computers->count()} computador(es) com sucesso!");

        return 0;
    }
}
