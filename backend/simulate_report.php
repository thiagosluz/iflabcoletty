<?php

require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Http\Controllers\Api\V1\ReportController;
use App\Models\User;
use Illuminate\Http\Request;

// Simular usuário autenticado (ID 1)
$user = User::find(1);
auth()->login($user);

echo 'User Authenticated: '.$user->name."\n";

// Criar request simulado
$request = Request::create('/api/v1/reports/labs/export', 'GET', [
    'format' => 'pdf',
    'search' => '',
    'async' => 'true', // Importante passar como string se for via query param
]);

$controller = app(ReportController::class);

echo "Dispatching Report Job...\n";

try {
    $response = $controller->exportLabs($request);

    echo 'Response Status: '.$response->status()."\n";
    echo 'Response Content: '.$response->content()."\n";

    $data = json_decode($response->content(), true);
    $jobId = $data['job_id'] ?? null;

    if ($jobId) {
        echo 'Job ID created: '.$jobId."\n";

        // Monitorar status
        for ($i = 0; $i < 10; $i++) {
            sleep(1);
            $job = \App\Models\ReportJob::find($jobId);
            echo "Time {$i}s - Job Status: ".$job->status."\n";
            if ($job->status === 'completed' || $job->status === 'failed') {
                break;
            }
        }
    } else {
        echo "No Job ID returned.\n";
    }

} catch (\Exception $e) {
    echo 'Exception: '.$e->getMessage()."\n";
    echo 'Trace: '.$e->getTraceAsString()."\n";
}
