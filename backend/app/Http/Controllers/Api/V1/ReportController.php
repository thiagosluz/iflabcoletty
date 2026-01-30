<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateReportJob;
use App\Models\Computer;
use App\Models\Lab;
use App\Models\ReportJob;
use App\Models\Software;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use League\Csv\Writer;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    /**
     * Export labs report (async)
     */
    public function exportLabs(Request $request)
    {
        $this->authorize('reports.create');

        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
            'async' => 'nullable',
        ]);

        // Normalize async parameter (handle string "true"/"false" or boolean from frontend)
        $async = $validated['async'] ?? false;
        \Log::info('exportLabs - async parameter received: '.var_export($async, true).' (type: '.gettype($async).')');

        if (is_string($async)) {
            $async = filter_var($async, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($async === null) {
                $async = false;
            }
        }
        $async = (bool) $async;

        \Log::info('exportLabs - async parameter normalized: '.($async ? 'true' : 'false'));

        // If async is false or not set, use synchronous export (backward compatibility)
        if (! $async) {
            \Log::info('exportLabs - Using synchronous export');

            return $this->exportLabsSync($request);
        }

        \Log::info('exportLabs - Using asynchronous export');

        // Create report job record
        $reportJob = ReportJob::create([
            'user_id' => auth()->id(),
            'type' => 'labs',
            'format' => $validated['format'],
            'filters' => [
                'search' => $validated['search'] ?? null,
            ],
            'status' => 'pending',
        ]);

        // Dispatch job to queue immediately
        try {
            GenerateReportJob::dispatch(
                $reportJob->id,
                'labs',
                $validated['format'],
                ['search' => $validated['search'] ?? null]
            )->onQueue('default');

            \Log::info("Report job {$reportJob->id} dispatched to queue");
        } catch (\Exception $e) {
            \Log::error("Failed to dispatch report job {$reportJob->id}: ".$e->getMessage());
            // Update job status to failed
            $reportJob->update([
                'status' => 'failed',
                'error_message' => 'Falha ao despachar job para a fila: '.$e->getMessage(),
            ]);
            throw $e;
        }

        return response()->json([
            'message' => 'Relatório em processamento',
            'job_id' => $reportJob->id,
            'status' => 'pending',
        ], 202);
    }

    /**
     * Synchronous export for backward compatibility
     */
    private function exportLabsSync(Request $request)
    {
        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
        ]);

        $query = Lab::withCount('computers');

        // Apply search filter
        if (! empty($validated['search'])) {
            $query->where(function ($q) use ($validated) {
                $q->where('name', 'like', "%{$validated['search']}%")
                    ->orWhere('description', 'like', "%{$validated['search']}%");
            });
        }

        $labs = $query->orderBy('name')->get();

        if ($labs->isEmpty()) {
            return response()->json([
                'message' => 'Nenhum laboratório encontrado para exportar.',
            ], 404);
        }

        switch ($validated['format']) {
            case 'pdf':
                return $this->exportLabsAsPdf($labs);
            case 'csv':
                return $this->exportLabsAsCsv($labs);
            case 'xlsx':
                return $this->exportLabsAsXlsx($labs);
            default:
                return response()->json(['message' => 'Formato inválido'], 400);
        }
    }

    /**
     * Export computers report (async)
     */
    public function exportComputers(Request $request)
    {
        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
            'lab_id' => 'nullable|exists:labs,id',
            'status' => 'nullable|in:online,offline',
            'async' => 'nullable|boolean',
        ]);

        // If async is false or not set, use synchronous export (backward compatibility)
        if (! ($validated['async'] ?? false)) {
            return $this->exportComputersSync($request);
        }

        // Create report job record
        $reportJob = ReportJob::create([
            'user_id' => auth()->id(),
            'type' => 'computers',
            'format' => $validated['format'],
            'filters' => [
                'search' => $validated['search'] ?? null,
                'lab_id' => $validated['lab_id'] ?? null,
                'status' => $validated['status'] ?? null,
            ],
            'status' => 'pending',
        ]);

        // Dispatch job to queue immediately
        try {
            GenerateReportJob::dispatch(
                $reportJob->id,
                'computers',
                $validated['format'],
                [
                    'search' => $validated['search'] ?? null,
                    'lab_id' => $validated['lab_id'] ?? null,
                    'status' => $validated['status'] ?? null,
                ]
            )->onQueue('default');

            \Log::info("Report job {$reportJob->id} dispatched to queue");
        } catch (\Exception $e) {
            \Log::error("Failed to dispatch report job {$reportJob->id}: ".$e->getMessage());
            // Update job status to failed
            $reportJob->update([
                'status' => 'failed',
                'error_message' => 'Falha ao despachar job para a fila: '.$e->getMessage(),
            ]);
            throw $e;
        }

        return response()->json([
            'message' => 'Relatório em processamento',
            'job_id' => $reportJob->id,
            'status' => 'pending',
        ], 202);
    }

    /**
     * Synchronous export for backward compatibility
     */
    private function exportComputersSync(Request $request)
    {
        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
            'lab_id' => 'nullable|exists:labs,id',
            'status' => 'nullable|in:online,offline',
        ]);

        $query = Computer::with('lab');

        // Apply search filter
        if (! empty($validated['search'])) {
            $query->where(function ($q) use ($validated) {
                $q->where('hostname', 'like', "%{$validated['search']}%")
                    ->orWhere('machine_id', 'like', "%{$validated['search']}%");
            });
        }

        // Apply lab filter
        if (! empty($validated['lab_id'])) {
            $query->where('lab_id', $validated['lab_id']);
        }

        // Apply status filter
        if (! empty($validated['status'])) {
            if ($validated['status'] === 'online') {
                $query->where('updated_at', '>=', now()->subMinutes(5));
            } else {
                $query->where('updated_at', '<', now()->subMinutes(5));
            }
        }

        $computers = $query->orderBy('created_at', 'desc')->get();

        if ($computers->isEmpty()) {
            return response()->json([
                'message' => 'Nenhum computador encontrado para exportar.',
            ], 404);
        }

        switch ($validated['format']) {
            case 'pdf':
                return $this->exportComputersAsPdf($computers);
            case 'csv':
                return $this->exportComputersAsCsv($computers);
            case 'xlsx':
                return $this->exportComputersAsXlsx($computers);
            default:
                return response()->json(['message' => 'Formato inválido'], 400);
        }
    }

    /**
     * Export softwares report (async)
     */
    public function exportSoftwares(Request $request)
    {
        $this->authorize('reports.create');

        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
            'async' => 'nullable',
        ]);

        // Normalize async parameter (handle string "true"/"false" or boolean from frontend)
        $async = $validated['async'] ?? false;
        if (is_string($async)) {
            $async = filter_var($async, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($async === null) {
                $async = false;
            }
        }
        $async = (bool) $async;

        // If async is false or not set, use synchronous export (backward compatibility)
        if (! $async) {
            return $this->exportSoftwaresSync($request);
        }

        // Create report job record
        $reportJob = ReportJob::create([
            'user_id' => auth()->id(),
            'type' => 'softwares',
            'format' => $validated['format'],
            'filters' => [
                'search' => $validated['search'] ?? null,
            ],
            'status' => 'pending',
        ]);

        // Dispatch job to queue immediately
        try {
            GenerateReportJob::dispatch(
                $reportJob->id,
                'softwares',
                $validated['format'],
                ['search' => $validated['search'] ?? null]
            )->onQueue('default');

            \Log::info("Report job {$reportJob->id} dispatched to queue");
        } catch (\Exception $e) {
            \Log::error("Failed to dispatch report job {$reportJob->id}: ".$e->getMessage());
            // Update job status to failed
            $reportJob->update([
                'status' => 'failed',
                'error_message' => 'Falha ao despachar job para a fila: '.$e->getMessage(),
            ]);
            throw $e;
        }

        return response()->json([
            'message' => 'Relatório em processamento',
            'job_id' => $reportJob->id,
            'status' => 'pending',
        ], 202);
    }

    /**
     * Synchronous export for backward compatibility
     */
    private function exportSoftwaresSync(Request $request)
    {
        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
        ]);

        $query = Software::withCount('computers');

        // Apply search filter
        if (! empty($validated['search'])) {
            $query->where(function ($q) use ($validated) {
                $q->where('name', 'like', "%{$validated['search']}%")
                    ->orWhere('version', 'like', "%{$validated['search']}%")
                    ->orWhere('vendor', 'like', "%{$validated['search']}%");
            });
        }

        $softwares = $query->orderBy('name')->get();

        if ($softwares->isEmpty()) {
            return response()->json([
                'message' => 'Nenhum software encontrado para exportar.',
            ], 404);
        }

        switch ($validated['format']) {
            case 'pdf':
                return $this->exportSoftwaresAsPdf($softwares);
            case 'csv':
                return $this->exportSoftwaresAsCsv($softwares);
            case 'xlsx':
                return $this->exportSoftwaresAsXlsx($softwares);
            default:
                return response()->json(['message' => 'Formato inválido'], 400);
        }
    }

    /**
     * Export lab details report (single lab: complete or summary variant)
     */
    public function exportLabDetails(Request $request)
    {
        $this->authorize('reports.create');

        $validated = $request->validate([
            'lab_id' => 'required|exists:labs,id',
            'variant' => 'required|in:complete,summary',
            'format' => 'nullable|in:pdf',
            'async' => 'nullable|boolean',
        ]);

        $labId = (int) $validated['lab_id'];
        $variant = $validated['variant'];
        $async = $validated['async'] ?? true;

        if ($async) {
            $reportJob = ReportJob::create([
                'user_id' => auth()->id(),
                'type' => 'lab_details',
                'format' => $validated['format'] ?? 'pdf',
                'filters' => [
                    'lab_id' => $labId,
                    'variant' => $variant,
                ],
                'status' => 'pending',
            ]);

            try {
                GenerateReportJob::dispatch(
                    $reportJob->id,
                    'lab_details',
                    $validated['format'] ?? 'pdf',
                    ['lab_id' => $labId, 'variant' => $variant]
                )->onQueue('default');
            } catch (\Exception $e) {
                \Log::error('Failed to dispatch lab details report job: '.$e->getMessage());
                $reportJob->update([
                    'status' => 'failed',
                    'error_message' => 'Falha ao despachar job: '.$e->getMessage(),
                ]);
                throw $e;
            }

            return response()->json([
                'message' => 'Relatório em processamento',
                'job_id' => $reportJob->id,
                'status' => 'pending',
            ], 202);
        }

        return $this->exportLabDetailsSync($request);
    }

    /**
     * Synchronous export for lab details report
     */
    private function exportLabDetailsSync(Request $request)
    {
        $validated = $request->validate([
            'lab_id' => 'required|exists:labs,id',
            'variant' => 'required|in:complete,summary',
        ]);

        $lab = Lab::with('computers.softwares')->findOrFail($validated['lab_id']);
        $computers = $lab->computers;
        $stats = $this->buildLabDetailsStats($computers);
        $softwares = Software::whereHas('computers', function ($q) use ($lab) {
            $q->where('lab_id', $lab->id);
        })->withCount(['computers' => function ($q) use ($lab) {
            $q->where('lab_id', $lab->id);
        }])->orderBy('name')->get();

        try {
            $viewName = $validated['variant'] === 'complete'
                ? 'reports.lab_details_complete'
                : 'reports.lab_details_summary';
            $timestamp = now()->format('Y-m-d H:i:s');
            $pdf = Pdf::loadView($viewName, [
                'lab' => $lab,
                'stats' => $stats,
                'computers' => $computers,
                'softwares' => $softwares,
                'exportDate' => $timestamp,
            ]);
            $filename = 'lab-detalhes-'.$lab->id.'-'.$validated['variant'].'-'.now()->format('Y-m-d_His').'.pdf';

            return $pdf->download($filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar relatório de detalhes do laboratório: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar PDF: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Build lab stats from computers collection (same structure as LabController::show)
     *
     * @param  \Illuminate\Support\Collection|\Illuminate\Database\Eloquent\Collection  $computers
     */
    private function buildLabDetailsStats($computers): array
    {
        $computers = collect($computers);
        $totalComputers = $computers->count();
        if ($totalComputers === 0) {
            return [
                'total_computers' => 0,
                'online_computers' => 0,
                'offline_computers' => 0,
                'total_softwares' => 0,
                'hardware_averages' => null,
                'os_distribution' => [],
            ];
        }

        $timezone = 'America/Sao_Paulo';
        $threshold = Carbon::now($timezone)->subMinutes(5);
        $onlineCount = $computers->filter(function ($computer) use ($threshold, $timezone) {
            if (! $computer->updated_at) {
                return false;
            }
            $updatedAt = $computer->updated_at instanceof Carbon
                ? $computer->updated_at->setTimezone($timezone)
                : Carbon::parse($computer->updated_at, $timezone);

            return $updatedAt->gte($threshold);
        })->count();
        $offlineCount = $totalComputers - $onlineCount;

        $hardwareAverages = $this->buildLabDetailsHardwareAverages($computers);
        $osDistribution = $this->buildLabDetailsOsDistribution($computers);
        $uniqueSoftwares = $computers->flatMap(function ($computer) {
            return $computer->softwares ?? [];
        })->unique('id')->count();

        return [
            'total_computers' => $totalComputers,
            'online_computers' => $onlineCount,
            'offline_computers' => $offlineCount,
            'total_softwares' => $uniqueSoftwares,
            'hardware_averages' => $hardwareAverages,
            'os_distribution' => $osDistribution,
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection  $computers
     */
    private function buildLabDetailsHardwareAverages($computers): ?array
    {
        $computersWithHardware = collect($computers)->filter(fn ($c) => ! empty($c->hardware_info));
        if ($computersWithHardware->isEmpty()) {
            return null;
        }
        $count = $computersWithHardware->count();
        $avgPhysicalCores = $computersWithHardware->avg(fn ($c) => $c->hardware_info['cpu']['physical_cores'] ?? 0);
        $avgLogicalCores = $computersWithHardware->avg(fn ($c) => $c->hardware_info['cpu']['logical_cores'] ?? 0);
        $avgMemory = $computersWithHardware->avg(fn ($c) => $c->hardware_info['memory']['total_gb'] ?? 0);
        $avgDiskTotal = $computersWithHardware->avg(fn ($c) => $c->hardware_info['disk']['total_gb'] ?? 0);
        $avgDiskUsed = $computersWithHardware->avg(fn ($c) => $c->hardware_info['disk']['used_gb'] ?? 0);
        $avgDiskFree = $computersWithHardware->avg(fn ($c) => $c->hardware_info['disk']['free_gb'] ?? 0);
        $avgDiskUsagePercent = $avgDiskTotal > 0 ? round(($avgDiskUsed / $avgDiskTotal) * 100, 2) : 0;

        return [
            'cpu' => [
                'avg_physical_cores' => round($avgPhysicalCores, 2),
                'avg_logical_cores' => round($avgLogicalCores, 2),
            ],
            'memory' => ['avg_total_gb' => round($avgMemory, 2)],
            'disk' => [
                'avg_total_gb' => round($avgDiskTotal, 2),
                'avg_used_gb' => round($avgDiskUsed, 2),
                'avg_free_gb' => round($avgDiskFree, 2),
                'avg_usage_percent' => $avgDiskUsagePercent,
            ],
            'computers_with_hardware_info' => $count,
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection  $computers
     */
    private function buildLabDetailsOsDistribution($computers): array
    {
        $osCounts = [];
        foreach (collect($computers) as $computer) {
            if (empty($computer->hardware_info['os']['system'])) {
                continue;
            }
            $osName = $computer->hardware_info['os']['system'];
            $osRelease = $computer->hardware_info['os']['release'] ?? 'Desconhecido';
            $osKey = $osName.' '.$osRelease;
            if (! isset($osCounts[$osKey])) {
                $osCounts[$osKey] = ['system' => $osName, 'release' => $osRelease, 'count' => 0];
            }
            $osCounts[$osKey]['count']++;
        }

        return array_values($osCounts);
    }

    /**
     * Get report job status
     */
    public function getJobStatus(ReportJob $reportJob)
    {
        $this->authorize('reports.view');

        // Only allow users to see their own jobs
        if ($reportJob->user_id !== auth()->id()) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        return response()->json([
            'id' => $reportJob->id,
            'type' => $reportJob->type,
            'format' => $reportJob->format,
            'status' => $reportJob->status,
            'file_path' => $reportJob->file_path,
            'download_url' => $reportJob->download_url,
            'error_message' => $reportJob->error_message,
            'started_at' => $reportJob->started_at,
            'completed_at' => $reportJob->completed_at,
            'failed_at' => $reportJob->failed_at,
            'created_at' => $reportJob->created_at,
        ]);
    }

    /**
     * Download completed report
     */
    public function downloadReport(ReportJob $reportJob)
    {
        $this->authorize('reports.download');

        // Only allow users to download their own reports
        if ($reportJob->user_id !== auth()->id()) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        if (! $reportJob->isCompleted() || ! $reportJob->file_path) {
            return response()->json(['message' => 'Relatório não disponível'], 404);
        }

        if (! Storage::exists($reportJob->file_path)) {
            return response()->json(['message' => 'Arquivo não encontrado'], 404);
        }

        return Storage::download($reportJob->file_path);
    }

    /**
     * List user's report jobs
     */
    public function listJobs(Request $request)
    {
        $query = ReportJob::where('user_id', auth()->id())
            ->orderBy('created_at', 'desc');

        // Pagination
        $perPage = min(max((int) $request->query('per_page', 20), 5), 100);
        $jobs = $query->paginate($perPage);

        return response()->json($jobs);
    }

    // ========== PDF Export Methods ==========

    private function exportLabsAsPdf($labs)
    {
        try {
            $timestamp = now()->format('Y-m-d H:i:s');
            $pdf = Pdf::loadView('reports.labs', [
                'labs' => $labs,
                'exportDate' => $timestamp,
                'totalLabs' => $labs->count(),
            ]);

            $filename = 'laboratorios-'.now()->format('Y-m-d_His').'.pdf';

            return $pdf->download($filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar laboratórios como PDF: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar PDF: '.$e->getMessage(),
            ], 500);
        }
    }

    private function exportComputersAsPdf($computers)
    {
        try {
            $timestamp = now()->format('Y-m-d H:i:s');
            $pdf = Pdf::loadView('reports.computers', [
                'computers' => $computers,
                'exportDate' => $timestamp,
                'totalComputers' => $computers->count(),
            ]);

            $filename = 'computadores-'.now()->format('Y-m-d_His').'.pdf';

            return $pdf->download($filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar computadores como PDF: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar PDF: '.$e->getMessage(),
            ], 500);
        }
    }

    private function exportSoftwaresAsPdf($softwares)
    {
        try {
            $timestamp = now()->format('Y-m-d H:i:s');
            $pdf = Pdf::loadView('reports.softwares', [
                'softwares' => $softwares,
                'exportDate' => $timestamp,
                'totalSoftwares' => $softwares->count(),
            ]);

            $filename = 'softwares-'.now()->format('Y-m-d_His').'.pdf';

            return $pdf->download($filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar softwares como PDF: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar PDF: '.$e->getMessage(),
            ], 500);
        }
    }

    // ========== CSV Export Methods ==========

    private function exportLabsAsCsv($labs)
    {
        try {
            $csv = Writer::createFromString();
            $csv->setOutputBOM(Writer::BOM_UTF8);
            $csv->insertOne(['ID', 'Nome', 'Descrição', 'Total de Computadores', 'Data de Criação']);

            foreach ($labs as $lab) {
                $csv->insertOne([
                    $lab->id,
                    $lab->name,
                    $lab->description ?? '',
                    $lab->computers_count ?? 0,
                    $lab->created_at->format('d/m/Y H:i:s'),
                ]);
            }

            $filename = 'laboratorios-'.now()->format('Y-m-d_His').'.csv';

            return response($csv->toString(), 200)
                ->header('Content-Type', 'text/csv; charset=UTF-8')
                ->header('Content-Disposition', 'attachment; filename="'.$filename.'"');
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar laboratórios como CSV: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar CSV: '.$e->getMessage(),
            ], 500);
        }
    }

    private function exportComputersAsCsv($computers)
    {
        try {
            $csv = Writer::createFromString();
            $csv->setOutputBOM(Writer::BOM_UTF8);
            $csv->insertOne([
                'ID', 'Hostname', 'ID da Máquina', 'Laboratório', 'Status',
                'Última Atualização', 'Núcleos Físicos', 'Núcleos Lógicos',
                'Memória Total (GB)', 'Armazenamento Total (GB)', 'Sistema Operacional',
            ]);

            foreach ($computers as $computer) {
                $isOnline = now()->diffInMinutes($computer->updated_at) < 5;
                $status = $isOnline ? 'Online' : 'Offline';

                $hardwareInfo = $computer->hardware_info ?? [];
                $physicalCores = $hardwareInfo['cpu']['physical_cores'] ?? '';
                $logicalCores = $hardwareInfo['cpu']['logical_cores'] ?? '';
                $memory = $hardwareInfo['memory']['total_gb'] ?? '';
                $disk = $hardwareInfo['disk']['total_gb'] ?? '';
                $os = $hardwareInfo['os']['system'] ?? '';

                $csv->insertOne([
                    $computer->id,
                    $computer->hostname ?? '',
                    $computer->machine_id,
                    $computer->lab->name ?? '',
                    $status,
                    $computer->updated_at->format('d/m/Y H:i:s'),
                    $physicalCores,
                    $logicalCores,
                    $memory,
                    $disk,
                    $os,
                ]);
            }

            $filename = 'computadores-'.now()->format('Y-m-d_His').'.csv';

            return response($csv->toString(), 200)
                ->header('Content-Type', 'text/csv; charset=UTF-8')
                ->header('Content-Disposition', 'attachment; filename="'.$filename.'"');
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar computadores como CSV: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar CSV: '.$e->getMessage(),
            ], 500);
        }
    }

    private function exportSoftwaresAsCsv($softwares)
    {
        try {
            $csv = Writer::createFromString();
            $csv->setOutputBOM(Writer::BOM_UTF8);
            $csv->insertOne(['ID', 'Nome', 'Versão', 'Fabricante', 'Total de Computadores', 'Data de Criação']);

            foreach ($softwares as $software) {
                $csv->insertOne([
                    $software->id,
                    $software->name,
                    $software->version ?? '',
                    $software->vendor ?? '',
                    $software->computers_count ?? 0,
                    $software->created_at->format('d/m/Y H:i:s'),
                ]);
            }

            $filename = 'softwares-'.now()->format('Y-m-d_His').'.csv';

            return response($csv->toString(), 200)
                ->header('Content-Type', 'text/csv; charset=UTF-8')
                ->header('Content-Disposition', 'attachment; filename="'.$filename.'"');
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar softwares como CSV: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar CSV: '.$e->getMessage(),
            ], 500);
        }
    }

    // ========== XLSX Export Methods ==========

    private function exportLabsAsXlsx($labs)
    {
        try {
            $export = new class($labs) implements FromCollection, WithHeadings, WithMapping
            {
                private $labs;

                public function __construct($labs)
                {
                    $this->labs = $labs;
                }

                public function collection()
                {
                    return $this->labs;
                }

                public function headings(): array
                {
                    return ['ID', 'Nome', 'Descrição', 'Total de Computadores', 'Data de Criação'];
                }

                public function map($lab): array
                {
                    return [
                        $lab->id,
                        $lab->name,
                        $lab->description ?? '',
                        $lab->computers_count ?? 0,
                        $lab->created_at->format('d/m/Y H:i:s'),
                    ];
                }
            };

            $filename = 'laboratorios-'.now()->format('Y-m-d_His').'.xlsx';

            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar laboratórios como XLSX: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar XLSX: '.$e->getMessage(),
            ], 500);
        }
    }

    private function exportComputersAsXlsx($computers)
    {
        try {
            $export = new class($computers) implements FromCollection, WithHeadings, WithMapping
            {
                private $computers;

                public function __construct($computers)
                {
                    $this->computers = $computers;
                }

                public function collection()
                {
                    return $this->computers;
                }

                public function headings(): array
                {
                    return [
                        'ID', 'Hostname', 'ID da Máquina', 'Laboratório', 'Status',
                        'Última Atualização', 'Núcleos Físicos', 'Núcleos Lógicos',
                        'Memória Total (GB)', 'Armazenamento Total (GB)', 'Sistema Operacional',
                    ];
                }

                public function map($computer): array
                {
                    $isOnline = now()->diffInMinutes($computer->updated_at) < 5;
                    $status = $isOnline ? 'Online' : 'Offline';
                    $hardwareInfo = $computer->hardware_info ?? [];

                    return [
                        $computer->id,
                        $computer->hostname ?? '',
                        $computer->machine_id,
                        $computer->lab->name ?? '',
                        $status,
                        $computer->updated_at->format('d/m/Y H:i:s'),
                        $hardwareInfo['cpu']['physical_cores'] ?? '',
                        $hardwareInfo['cpu']['logical_cores'] ?? '',
                        $hardwareInfo['memory']['total_gb'] ?? '',
                        $hardwareInfo['disk']['total_gb'] ?? '',
                        $hardwareInfo['os']['system'] ?? '',
                    ];
                }
            };

            $filename = 'computadores-'.now()->format('Y-m-d_His').'.xlsx';

            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar computadores como XLSX: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar XLSX: '.$e->getMessage(),
            ], 500);
        }
    }

    private function exportSoftwaresAsXlsx($softwares)
    {
        try {
            $export = new class($softwares) implements FromCollection, WithHeadings, WithMapping
            {
                private $softwares;

                public function __construct($softwares)
                {
                    $this->softwares = $softwares;
                }

                public function collection()
                {
                    return $this->softwares;
                }

                public function headings(): array
                {
                    return ['ID', 'Nome', 'Versão', 'Fabricante', 'Total de Computadores', 'Data de Criação'];
                }

                public function map($software): array
                {
                    return [
                        $software->id,
                        $software->name,
                        $software->version ?? '',
                        $software->vendor ?? '',
                        $software->computers_count ?? 0,
                        $software->created_at->format('d/m/Y H:i:s'),
                    ];
                }
            };

            $filename = 'softwares-'.now()->format('Y-m-d_His').'.xlsx';

            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar softwares como XLSX: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao gerar XLSX: '.$e->getMessage(),
            ], 500);
        }
    }
}
