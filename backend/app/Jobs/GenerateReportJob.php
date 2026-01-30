<?php

namespace App\Jobs;

use App\Models\Computer;
use App\Models\Lab;
use App\Models\ReportJob;
use App\Models\Software;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Csv\Writer;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Facades\Excel;

class GenerateReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300; // 5 minutes

    public $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $reportJobId,
        public string $type, // 'labs', 'computers', 'softwares'
        public string $format, // 'pdf', 'csv', 'xlsx'
        public array $filters = []
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $reportJob = ReportJob::findOrFail($this->reportJobId);

        try {
            // Update status to processing
            $reportJob->update([
                'status' => 'processing',
                'started_at' => now(),
            ]);

            // Generate report based on type
            $filePath = match ($this->type) {
                'labs' => $this->generateLabsReport(),
                'computers' => $this->generateComputersReport(),
                'softwares' => $this->generateSoftwaresReport(),
                'lab_details' => $this->generateLabDetailsReport(),
                default => throw new \InvalidArgumentException("Invalid report type: {$this->type}")
            };

            // Update status to completed
            $reportJob->update([
                'status' => 'completed',
                'file_path' => $filePath,
                'completed_at' => now(),
            ]);

            Log::info("Report job {$this->reportJobId} completed successfully. File: {$filePath}");
        } catch (\Exception $e) {
            Log::error("Report job {$this->reportJobId} failed: ".$e->getMessage());

            $reportJob->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'failed_at' => now(),
            ]);

            throw $e; // Re-throw to trigger retry mechanism
        }
    }

    /**
     * Generate labs report
     */
    private function generateLabsReport(): string
    {
        $query = Lab::withCount('computers');

        // Apply search filter
        if (! empty($this->filters['search'])) {
            $query->where(function ($q) {
                $q->where('name', 'like', "%{$this->filters['search']}%")
                    ->orWhere('description', 'like', "%{$this->filters['search']}%");
            });
        }

        $labs = $query->orderBy('name')->get();

        if ($labs->isEmpty()) {
            throw new \Exception('Nenhum laboratório encontrado para exportar.');
        }

        return match ($this->format) {
            'pdf' => $this->exportLabsAsPdf($labs),
            'csv' => $this->exportLabsAsCsv($labs),
            'xlsx' => $this->exportLabsAsXlsx($labs),
            default => throw new \InvalidArgumentException("Invalid format: {$this->format}")
        };
    }

    /**
     * Generate computers report
     */
    private function generateComputersReport(): string
    {
        $query = Computer::with('lab');

        // Apply search filter
        if (! empty($this->filters['search'])) {
            $query->where(function ($q) {
                $q->where('hostname', 'like', "%{$this->filters['search']}%")
                    ->orWhere('machine_id', 'like', "%{$this->filters['search']}%");
            });
        }

        // Apply lab filter
        if (! empty($this->filters['lab_id'])) {
            $query->where('lab_id', $this->filters['lab_id']);
        }

        // Apply status filter
        if (! empty($this->filters['status'])) {
            if ($this->filters['status'] === 'online') {
                $query->where('updated_at', '>=', now()->subMinutes(5));
            } else {
                $query->where('updated_at', '<', now()->subMinutes(5));
            }
        }

        $computers = $query->orderBy('created_at', 'desc')->get();

        if ($computers->isEmpty()) {
            // Don't throw exception, just log and mark as failed with message
            \Log::warning('No computers found for export with filters: '.json_encode($this->filters));
            throw new \Exception('Nenhum computador encontrado para exportar com os filtros aplicados.');
        }

        return match ($this->format) {
            'pdf' => $this->exportComputersAsPdf($computers),
            'csv' => $this->exportComputersAsCsv($computers),
            'xlsx' => $this->exportComputersAsXlsx($computers),
            default => throw new \InvalidArgumentException("Invalid format: {$this->format}")
        };
    }

    /**
     * Generate softwares report
     */
    private function generateSoftwaresReport(): string
    {
        $query = Software::withCount('computers');

        // Apply search filter
        if (! empty($this->filters['search'])) {
            $query->where(function ($q) {
                $q->where('name', 'like', "%{$this->filters['search']}%")
                    ->orWhere('version', 'like', "%{$this->filters['search']}%")
                    ->orWhere('vendor', 'like', "%{$this->filters['search']}%");
            });
        }

        $softwares = $query->orderBy('name')->get();

        if ($softwares->isEmpty()) {
            throw new \Exception('Nenhum software encontrado para exportar.');
        }

        return match ($this->format) {
            'pdf' => $this->exportSoftwaresAsPdf($softwares),
            'csv' => $this->exportSoftwaresAsCsv($softwares),
            'xlsx' => $this->exportSoftwaresAsXlsx($softwares),
            default => throw new \InvalidArgumentException("Invalid format: {$this->format}")
        };
    }

    /**
     * Generate lab details report (complete or summary)
     */
    private function generateLabDetailsReport(): string
    {
        $labId = (int) ($this->filters['lab_id'] ?? 0);
        $variant = $this->filters['variant'] ?? 'complete';

        if (! $labId) {
            throw new \Exception('lab_id é obrigatório para relatório de detalhes do laboratório.');
        }

        $lab = Lab::with('computers.softwares')->findOrFail($labId);
        $computers = $lab->computers;
        $stats = $this->buildLabDetailsStats($computers);
        $softwares = Software::whereHas('computers', function ($q) use ($lab) {
            $q->where('lab_id', $lab->id);
        })->withCount(['computers' => function ($q) use ($lab) {
            $q->where('lab_id', $lab->id);
        }])->orderBy('name')->get();

        return $this->exportLabDetailsAsPdf($lab, $stats, $computers, $softwares, $variant);
    }

    /**
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
        $uniqueSoftwares = $computers->flatMap(fn ($c) => $c->softwares ?? [])->unique('id')->count();

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

    private function exportLabDetailsAsPdf($lab, array $stats, $computers, $softwares, string $variant): string
    {
        $viewName = $variant === 'complete' ? 'reports.lab_details_complete' : 'reports.lab_details_summary';
        $timestamp = now()->format('Y-m-d H:i:s');
        $pdf = Pdf::loadView($viewName, [
            'lab' => $lab,
            'stats' => $stats,
            'computers' => $computers,
            'softwares' => $softwares,
            'exportDate' => $timestamp,
        ]);
        $filename = 'reports/lab-detalhes-'.$lab->id.'-'.$variant.'-'.now()->format('Y-m-d_His').'.pdf';
        Storage::put($filename, $pdf->output());

        return $filename;
    }

    // ========== PDF Export Methods ==========

    private function exportLabsAsPdf($labs): string
    {
        $timestamp = now()->format('Y-m-d H:i:s');
        $pdf = Pdf::loadView('reports.labs', [
            'labs' => $labs,
            'exportDate' => $timestamp,
            'totalLabs' => $labs->count(),
        ]);

        $filename = 'reports/laboratorios-'.now()->format('Y-m-d_His').'.pdf';
        Storage::put($filename, $pdf->output());

        return $filename;
    }

    private function exportComputersAsPdf($computers): string
    {
        $timestamp = now()->format('Y-m-d H:i:s');
        $pdf = Pdf::loadView('reports.computers', [
            'computers' => $computers,
            'exportDate' => $timestamp,
            'totalComputers' => $computers->count(),
        ]);

        $filename = 'reports/computadores-'.now()->format('Y-m-d_His').'.pdf';
        Storage::put($filename, $pdf->output());

        return $filename;
    }

    private function exportSoftwaresAsPdf($softwares): string
    {
        $timestamp = now()->format('Y-m-d H:i:s');
        $pdf = Pdf::loadView('reports.softwares', [
            'softwares' => $softwares,
            'exportDate' => $timestamp,
            'totalSoftwares' => $softwares->count(),
        ]);

        $filename = 'reports/softwares-'.now()->format('Y-m-d_His').'.pdf';
        Storage::put($filename, $pdf->output());

        return $filename;
    }

    // ========== CSV Export Methods ==========

    private function exportLabsAsCsv($labs): string
    {
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

        $filename = 'reports/laboratorios-'.now()->format('Y-m-d_His').'.csv';
        Storage::put($filename, $csv->toString());

        return $filename;
    }

    private function exportComputersAsCsv($computers): string
    {
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

        $filename = 'reports/computadores-'.now()->format('Y-m-d_His').'.csv';
        Storage::put($filename, $csv->toString());

        return $filename;
    }

    private function exportSoftwaresAsCsv($softwares): string
    {
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

        $filename = 'reports/softwares-'.now()->format('Y-m-d_His').'.csv';
        Storage::put($filename, $csv->toString());

        return $filename;
    }

    // ========== XLSX Export Methods ==========

    private function exportLabsAsXlsx($labs): string
    {
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

        $filename = 'reports/laboratorios-'.now()->format('Y-m-d_His').'.xlsx';
        Excel::store($export, $filename);

        return $filename;
    }

    private function exportComputersAsXlsx($computers): string
    {
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

        $filename = 'reports/computadores-'.now()->format('Y-m-d_His').'.xlsx';
        Excel::store($export, $filename);

        return $filename;
    }

    private function exportSoftwaresAsXlsx($softwares): string
    {
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

        $filename = 'reports/softwares-'.now()->format('Y-m-d_His').'.xlsx';
        Excel::store($export, $filename);

        return $filename;
    }
}
