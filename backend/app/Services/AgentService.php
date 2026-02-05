<?php

namespace App\Services;

use App\Models\Computer;
use Illuminate\Support\Facades\Log;
use ZipArchive;

class AgentService
{
    /**
     * Get the latest agent version (from file or config).
     */
    public function getLatestVersion(): string
    {
        $versionFile = config('agent.storage.latest_version_file');

        if (is_string($versionFile) && file_exists($versionFile)) {
            return trim(file_get_contents($versionFile));
        }

        return config('app.agent_latest_version', '1.0.0');
    }

    /**
     * Get absolute path to the package ZIP for a version, or null if not found.
     */
    public function getPackagePath(string $version): ?string
    {
        $packagesDir = config('agent.storage.packages');
        $pattern = config('agent.package_filename_pattern');
        $filename = str_replace('{version}', $version, $pattern);
        $path = $packagesDir.DIRECTORY_SEPARATOR.$filename;

        if (file_exists($path)) {
            return $path;
        }

        return null;
    }

    /**
     * Get changelog content for a version, or null if not found.
     */
    public function getChangelog(string $version): ?string
    {
        $changelogsDir = config('agent.storage.changelogs');
        $path = $changelogsDir.DIRECTORY_SEPARATOR.$version.'.md';

        if (file_exists($path)) {
            return file_get_contents($path);
        }

        return null;
    }

    /**
     * Get update package size in bytes for a version.
     */
    public function getUpdateSize(string $version): int
    {
        $path = $this->getPackagePath($version);

        if ($path !== null && file_exists($path)) {
            return filesize($path);
        }

        return 0;
    }

    /**
     * Get download URL for a version (for API responses).
     */
    public function getDownloadUrl(string $version): string
    {
        return url("/api/v1/agent/download/{$version}");
    }

    /**
     * Find the agent source directory (first path that exists and contains main.py).
     */
    public function getAgentDir(): ?string
    {
        $paths = config('agent.possible_paths', []);

        foreach ($paths as $path) {
            if (is_dir($path) && file_exists($path.DIRECTORY_SEPARATOR.'main.py')) {
                return $path;
            }
        }

        return null;
    }

    /**
     * Get path to installer script for platform (windows|linux), or null if not found.
     */
    public function getInstallerPath(string $platform): ?string
    {
        if (! in_array($platform, ['windows', 'linux'], true)) {
            return null;
        }

        $filename = $platform === 'windows' ? 'install_windows.ps1' : 'install_linux.sh';
        $paths = config('agent.possible_paths', []);

        foreach ($paths as $agentDir) {
            $path = $agentDir.DIRECTORY_SEPARATOR.$filename;
            if (file_exists($path)) {
                Log::info("Found installer at: {$path}");

                return $path;
            }
        }

        Log::warning("Installer not found for platform: {$platform}", [
            'tried_paths' => array_map(fn ($p) => $p.DIRECTORY_SEPARATOR.$filename, $paths),
        ]);

        return null;
    }

    /**
     * Get list of available packages with metadata (no URL - controller adds).
     */
    public function getAvailablePackages(): array
    {
        $packagesDir = config('agent.storage.packages');
        $packages = [];

        if (! is_dir($packagesDir)) {
            mkdir($packagesDir, 0755, true);
        }

        if (! is_dir($packagesDir)) {
            return [];
        }

        $pattern = config('agent.package_filename_pattern');
        $globPattern = str_replace('{version}', '*', $pattern);
        $files = glob($packagesDir.DIRECTORY_SEPARATOR.$globPattern);

        if ($files === false) {
            return [];
        }

        $latestVersion = $this->getLatestVersion();

        foreach ($files as $file) {
            $basename = basename($file);
            if (preg_match('/iflab-agent-([\d.]+)\.zip$/', $basename, $matches)) {
                $version = $matches[1];
                $size = file_exists($file) ? filesize($file) : 0;
                $computersCount = Computer::where('agent_version', $version)->count();

                $packages[] = [
                    'version' => $version,
                    'size' => $size,
                    'size_human' => $this->formatBytes($size),
                    'download_url' => $this->getDownloadUrl($version),
                    'exists' => true,
                    'is_latest' => $version === $latestVersion,
                    'created_at' => file_exists($file) ? date('Y-m-d H:i:s', filemtime($file)) : null,
                    'computers_count' => $computersCount,
                ];
            }
        }

        usort($packages, fn ($a, $b) => version_compare($b['version'], $a['version']));

        return $packages;
    }

    /**
     * Get list of available installers (windows, linux) with metadata.
     */
    public function getAvailableInstallers(): array
    {
        $installers = [];

        foreach (['windows', 'linux'] as $platform) {
            $path = $this->getInstallerPath($platform);
            $filename = $platform === 'windows' ? 'install_windows.ps1' : 'install_linux.sh';

            if ($path !== null && file_exists($path)) {
                $size = filesize($path);
                $installers[] = [
                    'platform' => $platform,
                    'filename' => $filename,
                    'size' => $size,
                    'size_human' => $this->formatBytes($size),
                    'download_url' => url("/api/v1/agent/installer/{$platform}"),
                    'exists' => true,
                ];
            } else {
                $installers[] = [
                    'platform' => $platform,
                    'filename' => $filename,
                    'exists' => false,
                ];
            }
        }

        return $installers;
    }

    /**
     * Get source code availability and size info.
     */
    public function getSourceCodeInfo(): array
    {
        $agentDir = $this->getAgentDir();

        if ($agentDir === null) {
            return [
                'available' => false,
                'download_url' => null,
                'size' => 0,
            ];
        }

        $size = $this->calculateDirectorySize($agentDir);

        return [
            'available' => true,
            'download_url' => url('/api/v1/agent/source-code'),
            'size' => $size,
            'size_human' => $this->formatBytes($size),
        ];
    }

    /**
     * Create a ZIP of the agent source code in temp dir. Returns path or null on failure.
     */
    public function createSourceCodeZip(): ?string
    {
        $agentDir = $this->getAgentDir();

        if ($agentDir === null) {
            Log::error('Agent directory not found', ['tried_paths' => config('agent.possible_paths')]);

            return null;
        }

        $version = $this->getLatestVersion();
        $zipFilename = "iflab-agent-source-{$version}.zip";
        $tempDir = config('agent.storage.temp');
        $zipPath = $tempDir.DIRECTORY_SEPARATOR.$zipFilename;

        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        if (file_exists($zipPath)) {
            unlink($zipPath);
        }

        $zip = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return null;
        }

        $filesToInclude = config('agent.package_files', []);
        foreach ($filesToInclude as $file) {
            $filePath = $agentDir.DIRECTORY_SEPARATOR.$file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, $file);
            }
        }

        foreach (config('agent.package_files_optional', []) as $file) {
            $filePath = $agentDir.DIRECTORY_SEPARATOR.$file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, $file);
            }
        }

        $zip->close();

        return file_exists($zipPath) ? $zipPath : null;
    }

    /**
     * Delete a package by version. Throws on business rule violation or IO error.
     *
     * @throws \RuntimeException
     */
    public function deletePackage(string $version): void
    {
        $computersCount = Computer::where('agent_version', $version)->count();

        if ($computersCount > 0) {
            throw new \RuntimeException("Não é possível excluir: existem {$computersCount} computador(es) usando esta versão.");
        }

        $latestVersion = $this->getLatestVersion();
        if ($version === $latestVersion) {
            throw new \RuntimeException('Não é possível excluir a versão mais recente.');
        }

        $packagePath = $this->getPackagePath($version);

        if ($packagePath === null || ! file_exists($packagePath)) {
            throw new \RuntimeException('Pacote não encontrado.');
        }

        if (! unlink($packagePath)) {
            throw new \RuntimeException('Erro ao excluir o arquivo do pacote.');
        }

        Log::info("Agent package deleted: {$version}", [
            'path' => $packagePath,
            'user_id' => auth()->user()?->id,
        ]);
    }

    /**
     * Calculate directory size in bytes, excluding .venv, __pycache__, etc.
     */
    public function calculateDirectorySize(string $directory): int
    {
        $excludeDirs = ['.venv', '__pycache__', 'node_modules', '.git'];

        if (! is_dir($directory)) {
            return 0;
        }

        $size = 0;
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $path = $file->getPathname();
                $relativePath = str_replace($directory.DIRECTORY_SEPARATOR, '', $path);

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
     * Format bytes to human-readable string.
     */
    public static function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, $precision).' '.$units[$pow];
    }
}
