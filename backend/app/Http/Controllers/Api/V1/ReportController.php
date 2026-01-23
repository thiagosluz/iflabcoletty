<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Lab;
use App\Models\Computer;
use App\Models\Software;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use League\Csv\Writer;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Carbon\Carbon;

class ReportController extends Controller
{
    /**
     * Export labs report
     */
    public function exportLabs(Request $request)
    {
        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
        ]);

        $query = Lab::withCount('computers');

        // Apply search filter
        if (!empty($validated['search'])) {
            $query->where(function ($q) use ($validated) {
                $q->where('name', 'like', "%{$validated['search']}%")
                    ->orWhere('description', 'like', "%{$validated['search']}%");
            });
        }

        $labs = $query->orderBy('name')->get();

        if ($labs->isEmpty()) {
            return response()->json([
                'message' => 'Nenhum laboratório encontrado para exportar.'
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
     * Export computers report
     */
    public function exportComputers(Request $request)
    {
        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
            'lab_id' => 'nullable|exists:labs,id',
            'status' => 'nullable|in:online,offline',
        ]);

        $query = Computer::with('lab');

        // Apply search filter
        if (!empty($validated['search'])) {
            $query->where(function ($q) use ($validated) {
                $q->where('hostname', 'like', "%{$validated['search']}%")
                    ->orWhere('machine_id', 'like', "%{$validated['search']}%");
            });
        }

        // Apply lab filter
        if (!empty($validated['lab_id'])) {
            $query->where('lab_id', $validated['lab_id']);
        }

        // Apply status filter
        if (!empty($validated['status'])) {
            if ($validated['status'] === 'online') {
                $query->where('updated_at', '>=', now()->subMinutes(5));
            } else {
                $query->where('updated_at', '<', now()->subMinutes(5));
            }
        }

        $computers = $query->orderBy('created_at', 'desc')->get();

        if ($computers->isEmpty()) {
            return response()->json([
                'message' => 'Nenhum computador encontrado para exportar.'
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
     * Export softwares report
     */
    public function exportSoftwares(Request $request)
    {
        $validated = $request->validate([
            'format' => 'required|in:pdf,csv,xlsx',
            'search' => 'nullable|string',
        ]);

        $query = Software::withCount('computers');

        // Apply search filter
        if (!empty($validated['search'])) {
            $query->where(function ($q) use ($validated) {
                $q->where('name', 'like', "%{$validated['search']}%")
                    ->orWhere('version', 'like', "%{$validated['search']}%")
                    ->orWhere('vendor', 'like', "%{$validated['search']}%");
            });
        }

        $softwares = $query->orderBy('name')->get();

        if ($softwares->isEmpty()) {
            return response()->json([
                'message' => 'Nenhum software encontrado para exportar.'
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

    // ========== PDF Export Methods ==========

    private function exportLabsAsPdf($labs)
    {
        try {
            $timestamp = now()->format('Y-m-d H:i:s');
            $pdf = Pdf::loadView('reports.labs', [
                'labs' => $labs,
                'exportDate' => $timestamp,
                'totalLabs' => $labs->count()
            ]);

            $filename = 'laboratorios-' . now()->format('Y-m-d_His') . '.pdf';
            return $pdf->download($filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar laboratórios como PDF: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar PDF: ' . $e->getMessage()
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
                'totalComputers' => $computers->count()
            ]);

            $filename = 'computadores-' . now()->format('Y-m-d_His') . '.pdf';
            return $pdf->download($filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar computadores como PDF: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar PDF: ' . $e->getMessage()
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
                'totalSoftwares' => $softwares->count()
            ]);

            $filename = 'softwares-' . now()->format('Y-m-d_His') . '.pdf';
            return $pdf->download($filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar softwares como PDF: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar PDF: ' . $e->getMessage()
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

            $filename = 'laboratorios-' . now()->format('Y-m-d_His') . '.csv';
            return response($csv->toString(), 200)
                ->header('Content-Type', 'text/csv; charset=UTF-8')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar laboratórios como CSV: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar CSV: ' . $e->getMessage()
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
                'Memória Total (GB)', 'Armazenamento Total (GB)', 'Sistema Operacional'
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

            $filename = 'computadores-' . now()->format('Y-m-d_His') . '.csv';
            return response($csv->toString(), 200)
                ->header('Content-Type', 'text/csv; charset=UTF-8')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar computadores como CSV: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar CSV: ' . $e->getMessage()
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

            $filename = 'softwares-' . now()->format('Y-m-d_His') . '.csv';
            return response($csv->toString(), 200)
                ->header('Content-Type', 'text/csv; charset=UTF-8')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar softwares como CSV: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar CSV: ' . $e->getMessage()
            ], 500);
        }
    }

    // ========== XLSX Export Methods ==========

    private function exportLabsAsXlsx($labs)
    {
        try {
            $export = new class($labs) implements FromCollection, WithHeadings, WithMapping {
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

            $filename = 'laboratorios-' . now()->format('Y-m-d_His') . '.xlsx';
            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar laboratórios como XLSX: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar XLSX: ' . $e->getMessage()
            ], 500);
        }
    }

    private function exportComputersAsXlsx($computers)
    {
        try {
            $export = new class($computers) implements FromCollection, WithHeadings, WithMapping {
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
                        'Memória Total (GB)', 'Armazenamento Total (GB)', 'Sistema Operacional'
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

            $filename = 'computadores-' . now()->format('Y-m-d_His') . '.xlsx';
            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar computadores como XLSX: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar XLSX: ' . $e->getMessage()
            ], 500);
        }
    }

    private function exportSoftwaresAsXlsx($softwares)
    {
        try {
            $export = new class($softwares) implements FromCollection, WithHeadings, WithMapping {
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

            $filename = 'softwares-' . now()->format('Y-m-d_His') . '.xlsx';
            return Excel::download($export, $filename);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar softwares como XLSX: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao gerar XLSX: ' . $e->getMessage()
            ], 500);
        }
    }
}
