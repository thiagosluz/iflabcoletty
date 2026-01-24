<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\CacheService;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\LabController;
use App\Http\Controllers\Api\V1\ComputerController;
use App\Http\Controllers\Api\V1\SoftwareController;
use Illuminate\Http\Request;

class WarmCache extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'cache:warm 
                            {--all : Warm all caches}
                            {--dashboard : Warm dashboard cache}
                            {--labs : Warm labs cache}
                            {--computers : Warm computers cache}
                            {--softwares : Warm softwares cache}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Warm up the application cache';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Warming up cache...');

        $warmAll = $this->option('all');
        $warmDashboard = $this->option('dashboard');
        $warmLabs = $this->option('labs');
        $warmComputers = $this->option('computers');
        $warmSoftwares = $this->option('softwares');

        // If no specific option, warm all
        if (!$warmAll && !$warmDashboard && !$warmLabs && !$warmComputers && !$warmSoftwares) {
            $warmAll = true;
        }

        $startTime = microtime(true);

        if ($warmAll || $warmDashboard) {
            $this->warmDashboard();
        }

        if ($warmAll || $warmLabs) {
            $this->warmLabs();
        }

        if ($warmAll || $warmComputers) {
            $this->warmComputers();
        }

        if ($warmAll || $warmSoftwares) {
            $this->warmSoftwares();
        }

        $duration = round((microtime(true) - $startTime) * 1000, 2);
        $this->info("Cache warmed successfully in {$duration}ms");
    }

    /**
     * Warm dashboard cache
     */
    private function warmDashboard(): void
    {
        $this->info('Warming dashboard cache...');
        
        try {
            $controller = new DashboardController();
            $controller->stats();
            $this->line('  ✓ Dashboard cache warmed');
        } catch (\Exception $e) {
            $this->error('  ✗ Failed to warm dashboard cache: ' . $e->getMessage());
        }
    }

    /**
     * Warm labs cache
     */
    private function warmLabs(): void
    {
        $this->info('Warming labs cache...');
        
        try {
            $controller = new LabController();
            $request = new Request();
            
            // Warm common pagination sizes
            foreach ([10, 20, 50] as $perPage) {
                $request->merge(['per_page' => $perPage]);
                $controller->index($request);
            }
            
            $this->line('  ✓ Labs cache warmed');
        } catch (\Exception $e) {
            $this->error('  ✗ Failed to warm labs cache: ' . $e->getMessage());
        }
    }

    /**
     * Warm computers cache
     */
    private function warmComputers(): void
    {
        $this->info('Warming computers cache...');
        
        try {
            $controller = new ComputerController();
            $request = new Request();
            
            // Warm common pagination sizes
            foreach ([10, 20, 50] as $perPage) {
                $request->merge(['per_page' => $perPage]);
                $controller->index($request);
            }
            
            $this->line('  ✓ Computers cache warmed');
        } catch (\Exception $e) {
            $this->error('  ✗ Failed to warm computers cache: ' . $e->getMessage());
        }
    }

    /**
     * Warm softwares cache
     */
    private function warmSoftwares(): void
    {
        $this->info('Warming softwares cache...');
        
        try {
            $controller = new SoftwareController();
            $request = new Request();
            
            // Warm common pagination sizes
            foreach ([10, 20, 50] as $perPage) {
                $request->merge(['per_page' => $perPage]);
                $controller->index($request);
            }
            
            $this->line('  ✓ Softwares cache warmed');
        } catch (\Exception $e) {
            $this->error('  ✗ Failed to warm softwares cache: ' . $e->getMessage());
        }
    }
}
