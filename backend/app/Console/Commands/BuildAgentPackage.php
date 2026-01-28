<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use ZipArchive;

class BuildAgentPackage extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'agent:build-package {version?} {--force : Overwrite existing package}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Build a ZIP package of the agent for distribution and updates';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $version = $this->argument('version') ?: $this->getLatestVersion();
        $force = $this->option('force');

        $this->info("Building agent package version: {$version}");

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
            $this->error('Agent directory not found. Tried paths: '.implode(', ', $possiblePaths));

            return 1;
        }

        $this->info("Found agent directory: {$agentDir}");

        // Create packages directory
        $packagesDir = storage_path('app/agent/packages');
        if (! is_dir($packagesDir)) {
            mkdir($packagesDir, 0755, true);
            $this->info("Created packages directory: {$packagesDir}");
        }

        $zipFilename = "iflab-agent-{$version}.zip";
        $zipPath = $packagesDir.'/'.$zipFilename;

        // Check if package already exists
        if (file_exists($zipPath) && ! $force) {
            $this->warn("Package already exists: {$zipPath}");
            if (! $this->confirm('Overwrite existing package?', false)) {
                $this->info('Aborted.');

                return 0;
            }
        }

        // Create ZIP
        $this->info('Creating ZIP package...');
        $zip = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            $this->error("Failed to create ZIP file: {$zipPath}");

            return 1;
        }

        // Files to include in the package
        $filesToInclude = [
            'main.py',
            'config.py',
            'update.py',
            'requirements.txt',
            'install_windows.ps1',
            'install_linux.sh',
        ];

        $addedCount = 0;
        foreach ($filesToInclude as $file) {
            $filePath = $agentDir.'/'.$file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, $file);
                $addedCount++;
                $this->line("  Added: {$file}");
            } else {
                $this->warn("  Warning: {$file} not found");
            }
        }

        // Add README if exists
        $readmePath = $agentDir.'/README.md';
        if (file_exists($readmePath)) {
            $zip->addFile($readmePath, 'README.md');
            $this->line('  Added: README.md');
            $addedCount++;
        }

        // Create version file inside the package
        $versionContent = $version;
        $zip->addFromString('VERSION', $versionContent);
        $this->line("  Added: VERSION ({$version})");
        $addedCount++;

        // Also create .agent_version so fresh installs don't show 0.0.0
        $zip->addFromString('.agent_version', $versionContent);
        $this->line("  Added: .agent_version ({$version})");
        $addedCount++;

        $zip->close();

        if (! file_exists($zipPath)) {
            $this->error('Failed to create package file');

            return 1;
        }

        $size = filesize($zipPath);
        $sizeHuman = $this->formatBytes($size);

        $this->info('Package created successfully!');
        $this->line("  File: {$zipPath}");
        $this->line("  Size: {$sizeHuman} ({$size} bytes)");
        $this->line("  Files: {$addedCount}");

        // Update latest version file
        $versionFile = storage_path('app/agent/latest_version.txt');
        file_put_contents($versionFile, $version);
        $this->info("Updated latest version to: {$version}");

        return 0;
    }

    /**
     * Get latest version from config or default
     */
    private function getLatestVersion(): string
    {
        $versionFile = storage_path('app/agent/latest_version.txt');

        if (file_exists($versionFile)) {
            $currentVersion = trim(file_get_contents($versionFile));
            // Increment patch version
            $parts = explode('.', $currentVersion);
            if (count($parts) === 3) {
                $parts[2] = (int) $parts[2] + 1;

                return implode('.', $parts);
            }

            return $currentVersion;
        }

        return config('app.agent_latest_version', '1.0.0');
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
}
