<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class WolService
{
    /**
     * Send Wake-on-LAN magic packet via UDP broadcast.
     * MAC must be 12 hex chars (no separators) or will be normalized.
     *
     * @param  string  $mac  MAC address (with or without : or -)
     * @param  string|null  $broadcast  Broadcast IP (default 255.255.255.255)
     * @param  int  $port  WoL port (default 9)
     * @return bool True if packet was sent successfully
     */
    public static function send(string $mac, ?string $broadcast = null, int $port = 9): bool
    {
        $mac = preg_replace('/[^0-9A-Fa-f]/', '', $mac);
        if (strlen($mac) !== 12) {
            Log::warning('WoL: invalid MAC length', ['mac' => $mac]);

            return false;
        }

        $broadcast = $broadcast ?? '255.255.255.255';

        // Magic packet: 6 bytes 0xFF + 16 times the 6-byte MAC
        $macBinary = hex2bin($mac);
        if ($macBinary === false) {
            Log::warning('WoL: invalid MAC hex', ['mac' => $mac]);

            return false;
        }
        $packet = str_repeat("\xff", 6).str_repeat($macBinary, 16);

        $sock = @socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
        if ($sock === false) {
            Log::error('WoL: failed to create socket', ['error' => socket_strerror(socket_last_error())]);

            return false;
        }

        if (! @socket_set_option($sock, SOL_SOCKET, SO_BROADCAST, 1)) {
            Log::error('WoL: failed to set SO_BROADCAST');
            socket_close($sock);

            return false;
        }

        $sent = @socket_sendto($sock, $packet, strlen($packet), 0, $broadcast, $port);
        socket_close($sock);

        if ($sent === false || $sent !== strlen($packet)) {
            Log::error('WoL: failed to send packet', ['mac' => $mac, 'broadcast' => $broadcast]);

            return false;
        }

        Log::info('WoL: magic packet sent from server', ['mac' => $mac, 'broadcast' => $broadcast]);

        return true;
    }
}
