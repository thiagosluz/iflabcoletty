<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SendEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120; // 2 minutes
    public $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public string $to,
        public string $subject,
        public string $view,
        public array $data = [],
        public ?string $attachmentPath = null
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $mail = Mail::send($this->view, $this->data, function ($message) {
                $message->to($this->to)
                    ->subject($this->subject);

                // Attach file if provided
                if ($this->attachmentPath && \Storage::exists($this->attachmentPath)) {
                    $message->attach(\Storage::path($this->attachmentPath));
                }
            });

            Log::info("Email sent successfully to {$this->to}");
        } catch (\Exception $e) {
            Log::error("Failed to send email to {$this->to}: " . $e->getMessage());
            throw $e; // Re-throw to trigger retry mechanism
        }
    }
}
