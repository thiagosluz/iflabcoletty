<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use App\Models\ComputerCommand;
use App\Models\SoftwareInstallation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SoftwareInstallationController extends Controller
{
    /**
     * List all software installations
     */
    public function index(Request $request)
    {
        $this->authorize('software-installations.view');

        $query = SoftwareInstallation::with(['computer:id,hostname,machine_id', 'user:id,name,email'])
            ->orderBy('created_at', 'desc');

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }

        // Filter by computer
        if ($request->has('computer_id')) {
            $query->where('computer_id', $request->query('computer_id'));
        }

        // Search by software name
        if ($search = $request->query('search')) {
            $query->where('software_name', 'like', "%{$search}%");
        }

        // Pagination
        $perPage = min(max((int) $request->query('per_page', 20), 5), 100);
        $installations = $query->paginate($perPage);

        return response()->json($installations);
    }

    /**
     * Show a specific installation
     */
    public function show(SoftwareInstallation $softwareInstallation)
    {
        $this->authorize('software-installations.view');

        $softwareInstallation->load(['computer', 'user']);

        return response()->json($softwareInstallation);
    }

    /**
     * Upload installer file
     */
    public function upload(Request $request)
    {
        $this->authorize('software-installations.create');

        $validated = $request->validate([
            'file' => 'required|file|mimes:exe,msi,zip|max:512000', // 500MB max
        ]);

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension();
        $size = $file->getSize();

        // Generate unique file ID
        $fileId = Str::uuid()->toString();

        // Create directory structure: installers/{hash}/{filename}
        $hash = substr($fileId, 0, 2);
        $path = "installers/{$hash}/{$fileId}.{$extension}";

        // Store file
        $storedPath = $file->storeAs("installers/{$hash}", "{$fileId}.{$extension}", 'local');

        Log::info("Installer uploaded: {$originalName} -> {$storedPath}");

        return response()->json([
            'file_id' => $fileId,
            'filename' => $originalName,
            'size' => $size,
            'extension' => $extension,
            'download_url' => url("/api/v1/installers/{$fileId}/download"),
        ], 201);
    }

    /**
     * Download installer file (for agent)
     */
    public function download(string $fileId)
    {
        // Require authentication (agent or user)
        if (! auth()->check()) {
            return response()->json(['message' => 'Não autenticado'], 401);
        }

        // Find file by ID
        $hash = substr($fileId, 0, 2);
        $files = Storage::files("installers/{$hash}");

        foreach ($files as $file) {
            $basename = basename($file);
            if (str_starts_with($basename, $fileId)) {
                $fullPath = storage_path("app/{$file}");

                if (file_exists($fullPath)) {
                    return response()->download($fullPath, basename($file), [
                        'Content-Type' => 'application/octet-stream',
                    ]);
                }
            }
        }

        return response()->json(['message' => 'Arquivo não encontrado'], 404);
    }

    /**
     * Create software installation
     */
    public function store(Request $request)
    {
        $this->authorize('software-installations.create');

        $validated = $request->validate([
            'computer_ids' => 'required|array|min:1',
            'computer_ids.*' => 'exists:computers,id',
            'method' => 'required|string|in:upload,url,network',
            'software_name' => 'nullable|string|max:255',
            'install_args' => 'nullable|string|max:500',
            'silent_mode' => 'boolean',
            'reboot_after' => 'boolean',
            // Method-specific validations
            'file_id' => 'required_if:method,upload|string',
            'installer_url' => 'required_if:method,url|url|max:2048',
            'network_path' => 'required_if:method,network|string|max:500',
        ]);

        $computers = Computer::whereIn('id', $validated['computer_ids'])->get();

        // Filter only Windows computers
        $windowsComputers = $computers->filter(function ($computer) {
            $osSystem = $computer->hardware_info['os']['system'] ?? null;

            return $osSystem === 'Windows';
        });

        if ($windowsComputers->isEmpty()) {
            return response()->json([
                'message' => 'Nenhum computador Windows encontrado nos IDs fornecidos.',
                'skipped' => $computers->count() - $windowsComputers->count(),
            ], 422);
        }

        $created = 0;
        $errors = [];

        foreach ($windowsComputers as $computer) {
            try {
                // Build parameters for ComputerCommand
                $parameters = [
                    'method' => $validated['method'],
                    'software_name' => $validated['software_name'] ?? null,
                    'install_args' => $validated['install_args'] ?? '',
                    'silent_mode' => $validated['silent_mode'] ?? true,
                    'reboot_after' => $validated['reboot_after'] ?? false,
                ];

                // Add method-specific parameters
                if ($validated['method'] === 'upload') {
                    $parameters['file_id'] = $validated['file_id'];
                } elseif ($validated['method'] === 'url') {
                    $parameters['installer_url'] = $validated['installer_url'];
                } elseif ($validated['method'] === 'network') {
                    $parameters['network_path'] = $validated['network_path'];
                }

                // Create ComputerCommand
                $command = $computer->commands()->create([
                    'user_id' => auth()->id(),
                    'command' => 'install_software',
                    'parameters' => $parameters,
                    'status' => 'pending',
                ]);

                // Create SoftwareInstallation record for history
                SoftwareInstallation::create([
                    'computer_id' => $computer->id,
                    'user_id' => auth()->id(),
                    'software_name' => $validated['software_name'] ?? null,
                    'installer_type' => $validated['method'],
                    'file_id' => $validated['method'] === 'upload' ? $validated['file_id'] : null,
                    'installer_url' => $validated['method'] === 'url' ? $validated['installer_url'] : null,
                    'network_path' => $validated['method'] === 'network' ? $validated['network_path'] : null,
                    'install_args' => $validated['install_args'] ?? null,
                    'silent_mode' => $validated['silent_mode'] ?? true,
                    'reboot_after' => $validated['reboot_after'] ?? false,
                    'status' => 'pending',
                ]);

                $created++;
            } catch (\Exception $e) {
                $errors[] = "Falha em {$computer->hostname}: ".$e->getMessage();
                Log::error("Failed to create installation for computer {$computer->id}: ".$e->getMessage());
            }
        }

        return response()->json([
            'message' => "Instalação iniciada para {$created} computador(es) Windows.",
            'created' => $created,
            'skipped' => $computers->count() - $windowsComputers->count(),
            'errors' => $errors,
        ], 201);
    }
}
