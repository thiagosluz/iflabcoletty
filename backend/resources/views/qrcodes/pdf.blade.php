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
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }

        .header h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }

        .header-info {
            font-size: 12px;
            color: #666;
        }

        .qr-container {
            page-break-inside: avoid;
            margin-bottom: 30px;
            border: 1px solid #ddd;
            padding: 20px;
            text-align: center;
        }

        .qr-code {
            margin: 20px 0;
        }

        .computer-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .lab-name {
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
        }

        .public-url {
            font-size: 11px;
            color: #999;
            word-break: break-all;
            margin-top: 10px;
        }

        .footer {
            margin-top: 30px;
            padding-top: 15px;
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

    @foreach($qrCodes as $item)
        <div class="qr-container">
            <div class="computer-name">
                {{ $item['computer']->hostname ?: $item['computer']->machine_id }}
            </div>
            <div class="lab-name">
                {{ $item['computer']->lab->name ?? 'Laboratório Desconhecido' }}
            </div>
            <div class="qr-code">
                <img src="data:image/png;base64,{{ $item['qr_code_base64'] }}" alt="QR Code" width="200" height="200">
            </div>
            <div class="public-url">
                {{ $item['public_url'] }}
            </div>
        </div>
    @endforeach

    <div class="footer">
        <div>iFLab Coletty - Sistema de Gerenciamento de Laboratórios</div>
        <div>Gerado em {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
    </div>
</body>

</html>