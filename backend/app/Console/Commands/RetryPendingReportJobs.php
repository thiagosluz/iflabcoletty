<?php

namespace App\Console\Commands;

use App\Jobs\GenerateReportJob;
use App\Models\ReportJob;
use Illuminate\Console\Command;

class RetryPendingReportJobs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reports:retry-pending';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Retry processing pending report jobs';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $pendingJobs = ReportJob::where('status', 'pending')->get();

        if ($pendingJobs->isEmpty()) {
            $this->info('No pending jobs found.');

            return 0;
        }

        $this->info("Found {$pendingJobs->count()} pending jobs. Dispatching...");

        foreach ($pendingJobs as $job) {
            $this->comment("Dispatching job {$job->id} ({$job->type} - {$job->format})...");

            GenerateReportJob::dispatch(
                $job->id,
                $job->type,
                $job->format,
                $job->filters ?? []
            )->onQueue('default');
        }

        $this->info('All pending jobs have been dispatched to the queue.');

        return 0;
    }
}
