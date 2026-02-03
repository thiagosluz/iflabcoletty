<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>QR Codes de Computadores</title>
    <style>
        @page {
            margin: 20mm;
        }

        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }

        .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }

        .header h1 {
            margin: 0 0 8px 0;
            font-size: 22px;
        }

        .header-info {
            font-size: 11px;
            color: #666;
        }

        /* Cada página contém no máximo 3 itens, um abaixo do outro */
        .qr-page-group {
            page-break-after: always;
        }

        .qr-page-group:last-child {
            page-break-after: auto;
        }

        .qr-container {
            page-break-inside: avoid;
            margin-bottom: 18px;
            border: 1px solid #ddd;
            padding: 12px;
            text-align: center;
        }

        .qr-container:last-child {
            margin-bottom: 0;
        }

        .qr-code {
            margin: 8px 0;
        }

        .computer-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 4px;
        }

        .lab-name {
            font-size: 12px;
            color: #666;
            margin-bottom: 6px;
        }

        .public-url {
            font-size: 9px;
            color: #999;
            word-break: break-all;
            margin-top: 4px;
        }

        .footer {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
            color: #999;
        }
    </style>
</head>

<body>
    <div class="header">
        <h1>QR Codes de Computadores</h1>
        <div class="header-info">
            <div>Total de Computadores: {{ $totalComputers ?? count($qrCodes) }}</div>
            <div>Data de Exportação: {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
        </div>
    </div>

    @foreach(array_chunk($qrCodes, 3) as $group)
        <div class="qr-page-group">
            @foreach($group as $item)
                <div class="qr-container">
                    <div class="computer-name">
                        {{ $item['computer']->hostname ?: $item['computer']->machine_id }}
                    </div>
                    <div class="lab-name">
                        {{ $item['computer']->lab->name ?? 'Laboratório Desconhecido' }}
                    </div>
                    <div class="qr-code">
                        <img src="data:image/png;base64,{{ $item['qr_code_base64'] }}" alt="QR Code" width="160" height="160">
                    </div>
                    <div class="public-url">
                        {{ $item['public_url'] }}
                    </div>
                </div>
            @endforeach
        </div>
    @endforeach

    <div class="footer">
        <div>iFLab Coletty - Sistema de Gerenciamento de Laboratórios</div>
        <div>Gerado em {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
    </div>
</body>

</html>
