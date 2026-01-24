<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Traits\LogsActivity;

class ComputerController extends Controller
{
    use LogsActivity;
    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int)$perPage, 5), 100);
        
        return $this->buildComputerQuery($request)->paginate($perPage);
    }

    /**
     * Helper method to build the query, extracted for reusability
     */
    private function buildComputerQuery(Request $request)
    {
        // Optimized: Select only necessary fields and eager load lab with limited fields
        $query = Computer::with('lab:id,name')
            ->select('id', 'lab_id', 'hostname', 'machine_id', 'public_hash', 'updated_at', 'created_at');

        if ($request->has('lab_id')) {
            $query->where('lab_id', $request->query('lab_id'));
        }

        // Basic search by hostname or machine_id
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('hostname', 'like', "%{$search}%")
                    ->orWhere('machine_id', 'like', "%{$search}%");
            });
        }

        // Pagination
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int)$perPage, 5), 100); // Limit between 5 and 100

        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Find computer by machine_id (exact match)
     * Useful for agents that need to find computers immediately after creation
     */
    public function findByMachineId(Request $request, string $machineId)
    {
        $computer = Computer::where('machine_id', $machineId)
            ->select('id', 'lab_id', 'hostname', 'machine_id', 'public_hash', 'updated_at', 'created_at')
            ->with('lab:id,name')
            ->first();

        if (!$computer) {
            return response()->json([
                'message' => 'Computador não encontrado'
            ], 404);
        }

        return response()->json($computer);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'lab_id' => 'required|exists:labs,id',
            'machine_id' => 'required|string|unique:computers,machine_id',
            'hostname' => 'nullable|string',
        ]);

        $computer = Computer::create($validated);
        
        // Log activity
        $this->logActivity('create', $computer);
        
        return response()->json($computer, 201);
    }

    public function show(Computer $computer)
    {
        // Optimized: Eager load relationships to avoid N+1 queries
        return $computer->load([
            'lab:id,name,description',
            'activities' => function ($query) {
                $query->latest()->limit(20);
            }
        ]);
    }

    /**
     * Get paginated softwares for a computer
     */
    public function getSoftwares(Request $request, Computer $computer)
    {
        $query = $computer->softwares();

        // Search
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('version', 'like', "%{$search}%")
                    ->orWhere('vendor', 'like', "%{$search}%");
            });
        }

        // Pagination
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int)$perPage, 5), 100); // Limit between 5 and 100

        // Get paginated results with pivot data
        // Note: withPivot is already set in the relationship, so pivot data comes automatically
        $softwares = $query->orderBy('name')->paginate($perPage);

        return $softwares;
    }

    public function update(Request $request, Computer $computer)
    {
        $oldValues = $computer->toArray();
        
        $validated = $request->validate([
            'lab_id' => 'sometimes|exists:labs,id',
            'hostname' => 'nullable|string',
            'machine_id' => 'sometimes|string|unique:computers,machine_id,' . $computer->id,
            'hardware_info' => 'sometimes|array',
        ]);

        $computer->update($validated);
        
        // Log activity
        $this->logActivity('update', $computer, $oldValues, $computer->toArray());
        
        return response()->json($computer);
    }

    public function destroy(Computer $computer)
    {
        $oldValues = $computer->toArray();
        
        // Log activity before deleting (so we have the model reference)
        $this->logActivity('delete', $computer, $oldValues);
        
        $computer->delete();
        
        return response()->noContent();
    }

    /**
     * Receive detailed report from agent
     */
    public function report(Request $request, Computer $computer)
    {
        $validated = $request->validate([
            'hardware_info' => 'sometimes|array',
            'softwares' => 'sometimes|array',
            'softwares.*.name' => 'required|string',
            'softwares.*.version' => 'nullable|string',
            'softwares.*.vendor' => 'nullable|string',
        ]);

        // Update hardware info
        if (isset($validated['hardware_info'])) {
            $computer->update(['hardware_info' => $validated['hardware_info']]);
        }

        // Sync software
        if (isset($validated['softwares'])) {
            $softwareIds = [];
            foreach ($validated['softwares'] as $softwareData) {
                $software = \App\Models\Software::firstOrCreate([
                    'name' => $softwareData['name'],
                    'version' => $softwareData['version'] ?? null,
                ], [
                    'vendor' => $softwareData['vendor'] ?? null,
                ]);
                $softwareIds[$software->id] = ['installed_at' => now()];
            }
            $computer->softwares()->sync($softwareIds);
        }

        // Log activity
        $computer->activities()->create([
            'type' => 'agent_report',
            'description' => 'Agente enviou relatório detalhado do sistema',
        ]);

        return response()->json(['message' => 'Relatório recebido com sucesso']);
    }

    /**
     * Generate QR code for a single computer
     */
    public function generateQrCode(Computer $computer)
    {
        // Verify computer has public_hash
        if (empty($computer->public_hash)) {
            return response()->json([
                'message' => 'Este computador não possui public_hash. Gere um hash primeiro.'
            ], 400);
        }

        // Verify FRONTEND_URL is configured
        $frontendUrl = config('app.frontend_url');
        if (empty($frontendUrl)) {
            return response()->json([
                'message' => 'FRONTEND_URL não está configurado. Configure a variável de ambiente FRONTEND_URL no arquivo .env ou docker-compose.yml.'
            ], 500);
        }

        $publicUrl = $frontendUrl . '/public/pc/' . $computer->public_hash;

        $builder = new \Endroid\QrCode\Builder\Builder();
        $result = $builder->build(
            data: $publicUrl,
            size: 300,
            margin: 10
        );

        return response($result->getString())
            ->header('Content-Type', 'image/png');
    }

    /**
     * Export QR codes for multiple computers as PDF or ZIP
     */
    public function exportQrCodes(Request $request)
    {
        $validated = $request->validate([
            'lab_id' => 'nullable|exists:labs,id',
            'format' => 'required|in:pdf,zip',
        ]);

        try {

            // Verify FRONTEND_URL is configured
            $frontendUrl = config('app.frontend_url');
            if (empty($frontendUrl)) {
                return response()->json([
                    'message' => 'FRONTEND_URL não está configurado. Configure a variável de ambiente FRONTEND_URL no arquivo .env ou docker-compose.yml.'
                ], 500);
            }

            $query = Computer::with('lab');

            if (isset($validated['lab_id'])) {
                $query->where('lab_id', $validated['lab_id']);
            }

            $computers = $query->get();

            // Validate empty list
            if ($computers->isEmpty()) {
                return response()->json([
                    'message' => 'Nenhum computador encontrado para exportar. Verifique os filtros selecionados.'
                ], 404);
            }

            // Filter computers that have public_hash
            $computersWithHash = $computers->filter(function ($computer) {
                return !empty($computer->public_hash);
            });

            if ($computersWithHash->isEmpty()) {
                return response()->json([
                    'message' => 'Nenhum computador possui public_hash configurado. Execute o comando: php artisan computers:generate-hashes'
                ], 404);
            }

            if ($validated['format'] === 'pdf') {
                return $this->exportAsPdf($computersWithHash);
            } else {
                return $this->exportAsZip($computersWithHash);
            }
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar QR codes: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            return response()->json([
                'message' => 'Erro ao exportar QR codes: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export QR codes as PDF
     */
    private function exportAsPdf($computers)
    {
        try {
            $qrCodes = [];
            $frontendUrl = config('app.frontend_url');

            foreach ($computers as $computer) {
                $publicUrl = $frontendUrl . '/public/pc/' . $computer->public_hash;

                $builder = new \Endroid\QrCode\Builder\Builder();
                $result = $builder->build(
                    data: $publicUrl,
                    size: 200,
                    margin: 10
                );

                $qrCodes[] = [
                    'computer' => $computer,
                    'qr_code_base64' => base64_encode($result->getString()),
                    'public_url' => $publicUrl,
                ];
            }

            if (empty($qrCodes)) {
                return response()->json([
                    'message' => 'Nenhum QR code foi gerado.'
                ], 400);
            }

            $timestamp = now()->format('Y-m-d H:i:s');
            
            // Use DomPDF facade
            $pdf = Pdf::loadView('qrcodes.pdf', [
                'qrCodes' => $qrCodes,
                'exportDate' => $timestamp,
                'totalComputers' => count($qrCodes)
            ]);

            $downloadName = 'qrcodes-' . now()->format('Y-m-d_His') . '.pdf';
            return $pdf->download($downloadName);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar QR codes como PDF: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Erro ao gerar PDF: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export QR codes as ZIP
     */
    private function exportAsZip($computers)
    {
        try {
            $zip = new \ZipArchive();
            $timestamp = now()->format('Y-m-d_His');
            $zipFileName = storage_path('app/temp/qrcodes-' . $timestamp . '.zip');

            // Create temp directory if it doesn't exist
            $tempDir = storage_path('app/temp');
            if (!file_exists($tempDir)) {
                if (!mkdir($tempDir, 0755, true)) {
                    return response()->json([
                        'message' => 'Não foi possível criar o diretório temporário.'
                    ], 500);
                }
            }

            if ($zip->open($zipFileName, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
                return response()->json([
                    'message' => 'Não foi possível criar o arquivo ZIP.'
                ], 500);
            }

            $frontendUrl = config('app.frontend_url');
            $usedFilenames = [];

            foreach ($computers as $computer) {
                $publicUrl = $frontendUrl . '/public/pc/' . $computer->public_hash;

                $builder = new \Endroid\QrCode\Builder\Builder();
                $result = $builder->build(
                    data: $publicUrl,
                    size: 300,
                    margin: 10
                );

                // Generate unique filename to avoid conflicts
                $baseFilename = ($computer->hostname ?: $computer->machine_id);
                // Sanitize filename
                $baseFilename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $baseFilename);
                $filename = $baseFilename . '.png';
                $counter = 1;
                
                while (in_array($filename, $usedFilenames)) {
                    $filename = $baseFilename . '_' . $counter . '.png';
                    $counter++;
                }
                
                $usedFilenames[] = $filename;
                $zip->addFromString($filename, $result->getString());
            }

            $zip->close();

            if (!file_exists($zipFileName)) {
                return response()->json([
                    'message' => 'O arquivo ZIP não foi criado corretamente.'
                ], 500);
            }

            $downloadName = 'qrcodes-' . $timestamp . '.zip';
            return response()->download($zipFileName, $downloadName)->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            \Log::error('Erro ao exportar QR codes como ZIP: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Erro ao gerar ZIP: ' . $e->getMessage()
            ], 500);
        }
    }
}
