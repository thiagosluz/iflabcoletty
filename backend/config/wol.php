<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Wake-on-LAN: Send from server
    |--------------------------------------------------------------------------
    |
    | When true, the backend will attempt to send the WoL magic packet directly
    | from this server (same LAN as labs). When false or when send fails,
    | the command is queued on a proxy computer in the lab.
    |
    */

    'send_from_server' => env('WOL_SEND_FROM_SERVER', false),

];
