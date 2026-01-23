<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório de Computadores</title>
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

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 10px;
        }

        th {
            background-color: #f3f4f6;
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-weight: bold;
        }

        td {
            border: 1px solid #ddd;
            padding: 6px;
        }

        tr:nth-child(even) {
            background-color: #f9fafb;
        }

        .status-online {
            color: #059669;
            font-weight: bold;
        }

        .status-offline {
            color: #6b7280;
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
        <h1>Relatório de Computadores</h1>
        <div class="header-info">
            <div>Total de Computadores: {{ $totalComputers ?? count($computers) }}</div>
            <div>Data de Exportação: {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Hostname</th>
                <th>ID da Máquina</th>
                <th>Laboratório</th>
                <th>Status</th>
                <th>Última Atualização</th>
                <th>CPU (Físicos/Lógicos)</th>
                <th>Memória (GB)</th>
                <th>Armazenamento (GB)</th>
                <th>Sistema Operacional</th>
            </tr>
        </thead>
        <tbody>
            @foreach($computers as $computer)
                @php
                    $isOnline = now()->diffInMinutes($computer->updated_at) < 5;
                    $hardwareInfo = $computer->hardware_info ?? [];
                    $physicalCores = $hardwareInfo['cpu']['physical_cores'] ?? '-';
                    $logicalCores = $hardwareInfo['cpu']['logical_cores'] ?? '-';
                    $memory = $hardwareInfo['memory']['total_gb'] ?? '-';
                    $disk = $hardwareInfo['disk']['total_gb'] ?? '-';
                    $os = $hardwareInfo['os']['system'] ?? '-';
                @endphp
                <tr>
                    <td>{{ $computer->id }}</td>
                    <td>{{ $computer->hostname ?? '-' }}</td>
                    <td style="font-family: monospace; font-size: 9px;">{{ $computer->machine_id }}</td>
                    <td>{{ $computer->lab->name ?? '-' }}</td>
                    <td class="{{ $isOnline ? 'status-online' : 'status-offline' }}">
                        {{ $isOnline ? 'Online' : 'Offline' }}
                    </td>
                    <td>{{ $computer->updated_at->format('d/m/Y H:i:s') }}</td>
                    <td>{{ $physicalCores }} / {{ $logicalCores }}</td>
                    <td>{{ $memory }}</td>
                    <td>{{ $disk }}</td>
                    <td>{{ $os }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        <div>iFLab Coletty - Sistema de Gerenciamento de Laboratórios</div>
        <div>Gerado em {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
    </div>
</body>
</html>
