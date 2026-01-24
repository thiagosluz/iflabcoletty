<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Backup Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for database backups
    |
    */

    /**
     * Retention days for backups
     * Backups older than this will be automatically deleted
     */
    'retention_days' => env('BACKUP_RETENTION_DAYS', 30),

    /**
     * Backup storage disk
     */
    'disk' => env('BACKUP_DISK', 'local'),

    /**
     * Backup directory
     */
    'directory' => env('BACKUP_DIRECTORY', 'backups'),
];
