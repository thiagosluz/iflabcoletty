<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AgentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class AgentController extends Controller
{
    public function __construct(
        private AgentService $agentService
    ) {}

    /**
     * Check for agent updates
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkUpdate(Request $request)
    {
        $currentVersion = $request->query('current_version', '0.0.0');
        $platform = $request->query('platform', '');

        $latestVersion = $this->agentService->getLatestVersion();
        $updateAvailable = version_compare($latestVersion, $currentVersion, '>');

        $response = [
            'available' => $updateAvailable,
            'current_version' => $currentVersion,
            'latest_version' => $latestVersion,
            'version' => $latestVersion,
        ];

        if ($updateAvailable) {
            if ($platform === 'windows-frozen') {
                $baseUrl = config('app.agent_installer_base_url', '');
                if ($baseUrl !== '') {
                    $baseUrl = rtrim($baseUrl, '/');
                    $tag = str_starts_with($latestVersion, 'v') ? $latestVersion : 'v'.$latestVersion;
                    $response['download_url'] = $baseUrl.'/'.$tag.'/iflab-agent-setup-'.$tag.'.exe';
                }
            }
            if (empty($response['download_url']) && $platform !== 'windows-frozen') {
                $response['download_url'] = $this->agentService->getDownloadUrl($latestVersion);
            }
            $response['changelog'] = $this->agentService->getChangelog($latestVersion);
            $response['size'] = $this->agentService->getUpdateSize($latestVersion);
        }

        return response()->json($response);
    }

    /**
     * Download agent update package
     *
     * @return \Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function downloadUpdate(Request $request, string $version)
    {
        $this->authorize('computers.view');

        $packagePath = $this->agentService->getPackagePath($version);

        if (! $packagePath || ! file_exists($packagePath)) {
            return response()->json([
                'message' => 'Update package not found',
            ], 404);
        }

        return response()->download($packagePath, "iflab-agent-{$version}.zip", [
            'Content-Type' => 'application/zip',
        ]);
    }

    /**
     * Get the latest agent version (public for ComputerController etc.)
     */
    public function getLatestVersion(): string
    {
        return $this->agentService->getLatestVersion();
    }

    /**
     * Get agent version info (for admin)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function versionInfo(Request $request)
    {
        $this->authorize('computers.view');

        $latestVersion = $this->agentService->getLatestVersion();

        return response()->json([
            'latest_version' => $latestVersion,
            'package_exists' => $this->agentService->getPackagePath($latestVersion) !== null,
            'package_size' => $this->agentService->getUpdateSize($latestVersion),
        ]);
    }

    /**
     * List all available agent files for download
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function listFiles(Request $request)
    {
        $this->authorize('computers.view');

        $packages = $this->agentService->getAvailablePackages();
        $installers = $this->agentService->getAvailableInstallers();
        $sourceCode = $this->agentService->getSourceCodeInfo();

        Log::info('AgentController::listFiles', [
            'packages_count' => count($packages),
            'installers' => $installers,
            'source_code_available' => $sourceCode['available'],
        ]);

        return response()->json([
            'packages' => $packages,
            'installers' => $installers,
            'source_code' => $sourceCode,
            'latest_version' => $this->agentService->getLatestVersion(),
            'packages_info' => [
                'directory' => config('agent.storage.packages'),
                'how_to_create' => 'Run: php artisan agent:build-package [version]',
            ],
        ]);
    }

    /**
     * Build an agent package (ZIP) for a given version or automatically
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function buildPackage(Request $request)
    {
        $this->authorize('computers.view');

        $data = $request->validate([
            'version' => ['nullable', 'string', 'regex:/^\d+\.\d+\.\d+$/'],
            'force' => ['sometimes', 'boolean'],
        ]);

        $version = $data['version'] ?? null;
        $force = (bool) ($data['force'] ?? false);

        try {
            $artisanParams = [];

            if ($version !== null && $version !== '') {
                $artisanParams['version'] = $version;
            }

            if ($force) {
                $artisanParams['--force'] = true;
            }

            $exitCode = Artisan::call('agent:build-package', $artisanParams);
            $output = Artisan::output();

            if ($exitCode !== 0) {
                Log::error('agent:build-package failed', [
                    'exit_code' => $exitCode,
                    'output' => $output,
                    'params' => $artisanParams,
                ]);

                return response()->json([
                    'message' => 'Falha ao criar pacote do agente.',
                    'output' => $output,
                ], 500);
            }

            $finalVersion = $this->agentService->getLatestVersion();
            $packagePath = $this->agentService->getPackagePath($finalVersion);
            $size = $packagePath && file_exists($packagePath) ? filesize($packagePath) : null;

            return response()->json([
                'message' => 'Pacote do agente criado com sucesso.',
                'version' => $finalVersion,
                'path' => $packagePath,
                'size' => $size,
                'output' => $output,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error while building agent package', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Erro ao criar pacote do agente: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download installer script
     *
     * @return \Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function downloadInstaller(string $platform)
    {
        $this->authorize('computers.view');

        if (! in_array($platform, ['windows', 'linux'])) {
            return response()->json([
                'message' => 'Platform inválida. Use "windows" ou "linux"',
            ], 400);
        }

        $installerPath = $this->agentService->getInstallerPath($platform);

        if (! $installerPath || ! file_exists($installerPath)) {
            return response()->json([
                'message' => 'Script de instalação não encontrado',
            ], 404);
        }

        $filename = $platform === 'windows' ? 'install_windows.ps1' : 'install_linux.sh';
        $contentType = $platform === 'windows' ? 'application/x-powershell' : 'text/plain';

        return response()->download($installerPath, $filename, [
            'Content-Type' => $contentType,
        ]);
    }

    /**
     * Download source code as ZIP
     *
     * @return \Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function downloadSourceCode()
    {
        $this->authorize('computers.view');

        try {
            $zipPath = $this->agentService->createSourceCodeZip();

            if (! $zipPath || ! file_exists($zipPath)) {
                return response()->json([
                    'message' => 'Erro ao criar arquivo ZIP do código-fonte',
                ], 500);
            }

            $version = $this->agentService->getLatestVersion();
            $filename = "iflab-agent-source-{$version}.zip";

            return response()->download($zipPath, $filename, [
                'Content-Type' => 'application/zip',
            ])->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            Log::error('Error creating source code ZIP: '.$e->getMessage());

            return response()->json([
                'message' => 'Erro ao criar arquivo ZIP: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete an agent package (only if no computers are using it)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function deletePackage(Request $request, string $version)
    {
        $this->authorize('computers.view');

        try {
            $this->agentService->deletePackage($version);

            return response()->json([
                'message' => 'Pacote excluído com sucesso.',
            ]);
        } catch (\RuntimeException $e) {
            $message = $e->getMessage();

            if (str_contains($message, 'computador(es) usando')) {
                return response()->json(['message' => $message], 403);
            }
            if (str_contains($message, 'versão mais recente')) {
                return response()->json(['message' => $message], 403);
            }
            if (str_contains($message, 'Pacote não encontrado')) {
                return response()->json(['message' => $message], 404);
            }

            return response()->json(['message' => $message], 500);
        } catch (\Exception $e) {
            Log::error("Error deleting agent package: {$version}", [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Erro ao excluir o pacote: '.$e->getMessage(),
            ], 500);
        }
    }
}
