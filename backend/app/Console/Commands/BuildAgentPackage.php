<?php

namespace App\Console\Commands;

use App\Services\AgentService;
use Illuminate\Console\Command;
use ZipArchive;

class BuildAgentPackage extends Command
{
    protected $signature = 'agent:build-package {version?} {--force : Overwrite existing package}';

    protected $description = 'Build a ZIP package of the agent for distribution and updates';

    public function handle(): int
    {
        $version = $this->argument('version') ?: $this->getLatestVersionForBuild();
        $force = $this->option('force');

        $this->info("Building agent package version: {$version}");

        $agentDir = $this->findAgentDir();
        if ($agentDir === null) {
            $paths = config('agent.possible_paths', []);
            $this->error('Agent directory not found. Tried paths: '.implode(', ', $paths));

            return 1;
        }

        $this->info("Found agent directory: {$agentDir}");

        $packagesDir = config('agent.storage.packages');
        if (! is_dir($packagesDir)) {
            mkdir($packagesDir, 0755, true);
            $this->info("Created packages directory: {$packagesDir}");
        }

        $pattern = config('agent.package_filename_pattern');
        $zipFilename = str_replace('{version}', $version, $pattern);
        $zipPath = $packagesDir.DIRECTORY_SEPARATOR.$zipFilename;

        if (file_exists($zipPath) && ! $force) {
            $this->warn("Package already exists: {$zipPath}");
            if (! $this->confirm('Overwrite existing package?', false)) {
                $this->info('Aborted.');

                return 0;
            }
        }

        $this->info('Creating ZIP package...');
        $zip = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            $this->error("Failed to create ZIP file: {$zipPath}");

            return 1;
        }

        $addedCount = 0;

        foreach (config('agent.package_files', []) as $file) {
            $filePath = $agentDir.DIRECTORY_SEPARATOR.$file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, $file);
                $addedCount++;
                $this->line("  Added: {$file}");
            } else {
                $this->warn("  Warning: {$file} not found");
            }
        }

        foreach (config('agent.package_files_optional', []) as $file) {
            $filePath = $agentDir.DIRECTORY_SEPARATOR.$file;
            if (file_exists($filePath)) {
                $zip->addFile($filePath, $file);
                $addedCount++;
                $this->line("  Added: {$file}");
            }
        }

        $versionContent = $version;
        $zip->addFromString('VERSION', $versionContent);
        $this->line("  Added: VERSION ({$version})");
        $addedCount++;

        $zip->addFromString('.agent_version', $versionContent);
        $this->line("  Added: .agent_version ({$version})");
        $addedCount++;

        $zip->close();

        if (! file_exists($zipPath)) {
            $this->error('Failed to create package file');

            return 1;
        }

        $size = filesize($zipPath);
        $sizeHuman = AgentService::formatBytes($size);

        $this->info('Package created successfully!');
        $this->line("  File: {$zipPath}");
        $this->line("  Size: {$sizeHuman} ({$size} bytes)");
        $this->line("  Files: {$addedCount}");

        $versionFile = config('agent.storage.latest_version_file');
        if (is_string($versionFile)) {
            file_put_contents($versionFile, $version);
            $this->info("Updated latest version to: {$version}");
        }

        return 0;
    }

    /**
     * Find agent source directory using config paths.
     */
    private function findAgentDir(): ?string
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
     * Get version for build: when no argument, read from file and increment patch.
     */
    private function getLatestVersionForBuild(): string
    {
        $versionFile = config('agent.storage.latest_version_file');

        if (is_string($versionFile) && file_exists($versionFile)) {
            $currentVersion = trim(file_get_contents($versionFile));
            $parts = explode('.', $currentVersion);
            if (count($parts) === 3) {
                $parts[2] = (int) $parts[2] + 1;

                return implode('.', $parts);
            }

            return $currentVersion;
        }

        return config('app.agent_latest_version', '1.0.0');
    }
}
