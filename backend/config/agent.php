<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Agent source directory (possible paths)
    |--------------------------------------------------------------------------
    |
    | Directories where the agent source code may be located. First existing
    | path with main.py wins. Used by AgentService and BuildAgentPackage.
    |
    */
    'possible_paths' => [
        base_path('agent'),
        '/var/www/agent', // Docker volume mount path
        app_path('../agent'),
        storage_path('../agent'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Agent storage paths
    |--------------------------------------------------------------------------
    */
    'storage' => [
        'packages' => storage_path('app/agent/packages'),
        'changelogs' => storage_path('app/agent/changelogs'),
        'latest_version_file' => storage_path('app/agent/latest_version.txt'),
        'temp' => storage_path('app/temp'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Package filename pattern
    |--------------------------------------------------------------------------
    |
    | Use {version} as placeholder, e.g. iflab-agent-1.0.0.zip
    |
    */
    'package_filename_pattern' => 'iflab-agent-{version}.zip',

    /*
    |--------------------------------------------------------------------------
    | Files to include in agent package and source ZIP
    |--------------------------------------------------------------------------
    */
    'package_files' => [
        'main.py',
        'update.py',
        'requirements.txt',
        'install_windows.ps1',
        'install_linux.sh',
        'src/__init__.py',
        'src/config.py',
        'src/security.py',
        'src/api_client.py',
        'src/collectors/__init__.py',
        'src/collectors/hardware.py',
        'src/collectors/software.py',
        'src/commands/__init__.py',
        'src/commands/parser.py',
        'src/commands/executor.py',
        'src/commands/handlers.py',
        'src/features/__init__.py',
        'src/features/wallpaper.py',
        'src/features/updater.py',
        'src/features/kiosk.py',
        'src/utils/__init__.py',
        'src/utils/logger.py',
    ],

    /*
    |--------------------------------------------------------------------------
    | Optional files to include if present
    |--------------------------------------------------------------------------
    */
    'package_files_optional' => [
        'README.md',
    ],

];
