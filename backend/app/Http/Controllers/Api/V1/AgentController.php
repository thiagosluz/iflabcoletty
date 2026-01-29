<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class AgentController extends Controller
{
    /**
     * Check for agent updates
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkUpdate(Request $request)
    {
        // This endpoint can be accessed by agents (no auth required for now)
        // In production, you might want to add authentication

        $currentVersion = $request->query('current_version', '0.0.0');
        $platform = $request->query('platform', '');

        // Get the latest version from config or storage
        $latestVersion = $this->getLatestVersion();

        // Compare versions (simple string comparison, can be improved with semver)
        $updateAvailable = version_compare($latestVersion, $currentVersion, '>');

        $response = [
            'available' => $updateAvailable,
            'current_version' => $currentVersion,
            'latest_version' => $latestVersion,
            'version' => $latestVersion,
        ];

        if ($updateAvailable) {
            // For Windows frozen (PyInstaller installer), return URL to the .exe installer
            if ($platform === 'windows-frozen') {
                $baseUrl = config('app.agent_installer_base_url', '');
                if ($baseUrl !== '') {
                    $baseUrl = rtrim($baseUrl, '/');
                    $response['download_url'] = $baseUrl.'/'.$latestVersion.'/iflab-agent-setup-'.$latestVersion.'.exe';
                }
            }
            if (empty($response['download_url'])) {
                $response['download_url'] = $this->getDownloadUrl($latestVersion);
            }
            $response['changelog'] = $this->getChangelog($latestVersion);
            $response['size'] = $this->getUpdateSize($latestVersion);
        }

        return response()->json($response);
    }

    /**
     * Download agent update package
     *
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function downloadUpdate(Request $request, string $version)
    {
        // Requer autenticação e permissão para baixar atualizações
        $this->authorize('computers.view');

        // Verify version exists
        $packagePath = $this->getPackagePath($version);

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
     * Get the latest agent version
     */
    public function getLatestVersion(): string
    {
        // Option 1: Read from config file
        $versionFile = storage_path('app/agent/latest_version.txt');

        if (file_exists($versionFile)) {
            return trim(file_get_contents($versionFile));
        }

        // Option 2: Read from config
        $version = config('app.agent_latest_version', '1.0.0');

        return $version;
    }

    /**
     * Get download URL for a version
     */
    private function getDownloadUrl(string $version): string
    {
        // Generate URL to download endpoint
        return url("/api/v1/agent/download/{$version}");
    }

    /**
     * Get changelog for a version
     */
    private function getChangelog(string $version): ?string
    {
        $changelogFile = storage_path("app/agent/changelogs/{$version}.md");

        if (file_exists($changelogFile)) {
            return file_get_contents($changelogFile);
        }

        return null;
    }

    /**
     * Get update package size
     */
    private function getUpdateSize(string $version): int
    {
        $packagePath = $this->getPackagePath($version);

        if ($packagePath && file_exists($packagePath)) {
            return filesize($packagePath);
        }

        return 0;
    }

    /**
     * Get package file path for a version
     */
    private function getPackagePath(string $version): ?string
    {
        // Look for package in storage
        $packagePath = storage_path("app/agent/packages/iflab-agent-{$version}.zip");

        if (file_exists($packagePath)) {
            return $packagePath;
        }

        return null;
    }

    /**
     * Get agent version info (for admin)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function versionInfo(Request $request)
    {
        $this->authorize('computers.view');

        return response()->json([
            'latest_version' => $this->getLatestVersion(),
            'package_exists' => $this->getPackagePath($this->getLatestVersion()) !== null,
            'package_size' => $this->getUpdateSize($this->getLatestVersion()),
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

        $packages = $this->getAvailablePackages();
        $installers = $this->getAvailableInstallers();
        $sourceCode = $this->getSourceCodeInfo();

        Log::info('AgentController::listFiles', [
            'packages_count' => count($packages),
            'installers' => $installers,
            'source_code_available' => $sourceCode['available'],
        ]);

        return response()->json([
            'packages' => $packages,
            'installers' => $installers,
            'source_code' => $sourceCode,
            'latest_version' => $this->getLatestVersion(),
            'packages_info' => [
                'directory' => storage_path('app/agent/packages'),
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

            // Descobrir a versão final a partir do arquivo latest_version.txt
            $latestVersionFile = storage_path('app/agent/latest_version.txt');
            $finalVersion = $version;

            if (file_exists($latestVersionFile)) {
                $finalVersion = trim(file_get_contents($latestVersionFile));
            }

            // Caminho do pacote gerado
            $packagePath = null;
            $size = null;

            if ($finalVersion) {
                $packagePath = $this->getPackagePath($finalVersion);
                if ($packagePath && file_exists($packagePath)) {
                    $size = filesize($packagePath);
                }
            }

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
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function downloadInstaller(string $platform)
    {
        $this->authorize('computers.view');

        if (! in_array($platform, ['windows', 'linux'])) {
            return response()->json([
                'message' => 'Platform inválida. Use "windows" ou "linux"',
            ], 400);
        }

        $installerPath = $this->getInstallerPath($platform);

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
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function downloadSourceCode()
    {
        $this->authorize('computers.view');

        try {
            $zipPath = $this->createSourceCodeZip();

            if (! $zipPath || ! file_exists($zipPath)) {
                return response()->json([
                    'message' => 'Erro ao criar arquivo ZIP do código-fonte',
                ], 500);
            }

            $version = $this->getLatestVersion();
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
     * Get available packages
     */
    private function getAvailablePackages(): array
    {
        $packagesDir = storage_path('app/agent/packages');
        $packages = [];

        // Create directory if it doesn't exist
        if (! is_dir($packagesDir)) {
            mkdir($packagesDir, 0755, true);
        }

        if (is_dir($packagesDir)) {
            $files = glob($packagesDir.'/iflab-agent-*.zip');

            foreach ($files as $file) {
                // Extract version from filename: iflab-agent-1.0.0.zip
                if (preg_match('/iflab-agent-([\d.]+)\.zip$/', basename($file), $matches)) {
                    $version = $matches[1];
                    $size = file_exists($file) ? filesize($file) : 0;
                    $latestVersion = $this->getLatestVersion();

                    // Count computers using this agent version
                    $computersCount = Computer::where('agent_version', $version)->count();

                    $packages[] = [
                        'version' => $version,
                        'size' => $size,
                        'size_human' => $this->formatBytes($size),
                        'download_url' => url("/api/v1/agent/download/{$version}"),
                        'exists' => true,
                        'is_latest' => $version === $latestVersion,
                        'created_at' => file_exists($file) ? date('Y-m-d H:i:s', filemtime($file)) : null,
                        'computers_count' => $computersCount,
                    ];
                }
            }

            // Sort by version (descending)
            usort($packages, function ($a, $b) {
                return version_compare($b['version'], $a['version']);
            });
        }

        return $packages;
    }

    /**
     * Get available installers
     */
    private function getAvailableInstallers(): array
    {
        $installers = [];

        // Windows installer
        $windowsPath = $this->getInstallerPath('windows');
        if ($windowsPath && file_exists($windowsPath)) {
            $installers[] = [
                'platform' => 'windows',
                'filename' => 'install_windows.ps1',
                'size' => filesize($windowsPath),
                'size_human' => $this->formatBytes(filesize($windowsPath)),
                'download_url' => url('/api/v1/agent/installer/windows'),
                'exists' => true,
            ];
        } else {
            $installers[] = [
                'platform' => 'windows',
                'filename' => 'install_windows.ps1',
                'exists' => false,
            ];
        }

        // Linux installer
        $linuxPath = $this->getInstallerPath('linux');
        if ($linuxPath && file_exists($linuxPath)) {
            $installers[] = [
                'platform' => 'linux',
                'filename' => 'install_linux.sh',
                'size' => filesize($linuxPath),
                'size_human' => $this->formatBytes(filesize($linuxPath)),
                'download_url' => url('/api/v1/agent/installer/linux'),
                'exists' => true,
            ];
        } else {
            $installers[] = [
                'platform' => 'linux',
                'filename' => 'install_linux.sh',
                'exists' => false,
            ];
        }

        return $installers;
    }

    /**
     * Get source code info
     */
    private function getSourceCodeInfo(): array
    {
        // Find agent directory
        $possiblePaths = [
            base_path('agent'),
            '/var/www/agent', // Docker volume mount path
            app_path('../agent'),
            storage_path('../agent'),
        ];

        $agentDir = null;
        foreach ($possiblePaths as $path) {
            if (is_dir($path) && file_exists($path.'/main.py')) {
                $agentDir = $path;
                break;
            }
        }

        if (! $agentDir) {
            return [
                'available' => false,
                'download_url' => null,
                'size' => 0,
            ];
        }

        // Estimate size (rough calculation)
        $size = $this->calculateDirectorySize($agentDir);

        return [
            'available' => true,
            'download_url' => url('/api/v1/agent/source-code'),
            'size' => $size,
            'size_human' => $this->formatBytes($size),
        ];
    }

    /**
     * Get installer path
     */
    private function getInstallerPath(string $platform): ?string
    {
        // Try multiple possible paths
        $possiblePaths = [
            base_path('agent'), // Laravel base path (if agent is in project root)
            '/var/www/agent', // Docker volume mount path
            app_path('../agent'), // Relative to app directory
            storage_path('../agent'), // Relative to storage
        ];

        $filename = $platform === 'windows' ? 'install_windows.ps1' : 'install_linux.sh';

        foreach ($possiblePaths as $agentDir) {
            $path = $agentDir.'/'.$filename;
            if (file_exists($path)) {
                Log::info("Found installer at: {$path}");

                return $path;
            }
        }

        Log::warning("Installer not found for platform: {$platform}", [
            'tried_paths' => array_map(fn ($p) => $p.'/'.$filename, $possiblePaths),
        ]);

        return null;
    }

    /**
     * Create source code ZIP
     */
    private function createSourceCodeZip(): ?string
    {
        // Find agent directory
        $possiblePaths = [
            base_path('agent'),
            '/var/www/agent', // Docker volume mount path
            app_path('../agent'),
            storage_path('../agent'),
        ];

        $agentDir = null;
        foreach ($possiblePaths as $path) {
            if (is_dir($path) && file_exists($path.'/main.py')) {
                $agentDir = $path;
                break;
            }
        }

        if (! $agentDir) {
            Log::error('Agent directory not found', ['tried_paths' => $possiblePaths]);

            return null;
        }

        $version = $this->getLatestVersion();
        $zipFilename = "iflab-agent-source-{$version}.zip";
        $tempDir = storage_path('app/temp');
        $zipPath = $tempDir.'/'.$zipFilename;

        // Create temp directory if it doesn't exist
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // Remove old ZIP if exists
        if (file_exists($zipPath)) {
            unlink($zipPath);
        }

        $zip = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return null;
        }

        // Files and directories to include
        $filesToInclude = [
            'main.py',
            'config.py',
            'update.py',
            'requirements.txt',
            'install_windows.ps1',
            'install_linux.sh',
        ];

        // Add files
        foreach ($filesToInclude as $file) {
            $filePath = $agentDir.'/'.$file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, $file);
            }
        }

        // Add README if exists
        $readmePath = $agentDir.'/README.md';
        if (file_exists($readmePath)) {
            $zip->addFile($readmePath, 'README.md');
        }

        $zip->close();

        return file_exists($zipPath) ? $zipPath : null;
    }

    /**
     * Calculate directory size (excluding .venv and __pycache__)
     */
    private function calculateDirectorySize(string $directory): int
    {
        $size = 0;
        $excludeDirs = ['.venv', '__pycache__', 'node_modules', '.git'];

        if (! is_dir($directory)) {
            return 0;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $path = $file->getPathname();
                $relativePath = str_replace($directory.'/', '', $path);

                // Skip excluded directories
                $shouldExclude = false;
                foreach ($excludeDirs as $excludeDir) {
                    if (strpos($relativePath, $excludeDir) === 0) {
                        $shouldExclude = true;
                        break;
                    }
                }

                if (! $shouldExclude) {
                    $size += $file->getSize();
                }
            }
        }

        return $size;
    }

    /**
     * Format bytes to human readable
     */
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, $precision).' '.$units[$pow];
    }

    /**
     * Delete an agent package (only if no computers are using it)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function deletePackage(Request $request, string $version)
    {
        $this->authorize('computers.view');

        // Check if any computers are using this version
        $computersCount = Computer::where('agent_version', $version)->count();

        if ($computersCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir: existem {$computersCount} computador(es) usando esta versão.",
            ], 403);
        }

        // Check if this is the latest version
        $latestVersion = $this->getLatestVersion();
        if ($version === $latestVersion) {
            return response()->json([
                'message' => 'Não é possível excluir a versão mais recente.',
            ], 403);
        }

        // Get package path
        $packagePath = $this->getPackagePath($version);

        if (! $packagePath || ! file_exists($packagePath)) {
            return response()->json([
                'message' => 'Pacote não encontrado.',
            ], 404);
        }

        // Delete the package file
        try {
            if (unlink($packagePath)) {
                Log::info("Agent package deleted: {$version}", [
                    'path' => $packagePath,
                    'user_id' => auth()->id(),
                ]);

                return response()->json([
                    'message' => 'Pacote excluído com sucesso.',
                ]);
            } else {
                return response()->json([
                    'message' => 'Erro ao excluir o arquivo do pacote.',
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error("Error deleting agent package: {$version}", [
                'error' => $e->getMessage(),
                'path' => $packagePath,
            ]);

            return response()->json([
                'message' => 'Erro ao excluir o pacote: '.$e->getMessage(),
            ], 500);
        }
    }
}
