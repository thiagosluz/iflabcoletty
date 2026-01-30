<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório Completo - {{ $lab->name }}</title>
    <style>
        @page { margin: 20mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .header h1 { margin: 0 0 10px 0; font-size: 24px; }
        .header-info { font-size: 12px; color: #666; }
        h2 { font-size: 14px; margin: 20px 0 10px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
        th { background-color: #f3f4f6; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; }
        td { border: 1px solid #ddd; padding: 6px; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .status-online { color: #059669; font-weight: bold; }
        .status-offline { color: #6b7280; }
        .stats-grid { display: table; width: 100%; margin: 15px 0; }
        .stats-grid .stat { display: table-cell; padding: 10px; text-align: center; border: 1px solid #ddd; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Relatório Completo - {{ $lab->name }}</h1>
        <div class="header-info">
            @if($lab->description)
                <div>{{ $lab->description }}</div>
            @endif
            <div>Data de Exportação: {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
        </div>
    </div>

    <h2>1. Resumo</h2>
    <div class="stats-grid">
        <div class="stat">Total de Computadores: <strong>{{ $stats['total_computers'] }}</strong></div>
        <div class="stat">Online: <strong>{{ $stats['online_computers'] }}</strong></div>
        <div class="stat">Offline: <strong>{{ $stats['offline_computers'] }}</strong></div>
        <div class="stat">Softwares Únicos: <strong>{{ $stats['total_softwares'] }}</strong></div>
    </div>

    @if($stats['hardware_averages'])
    <h2>2. Médias de Configuração</h2>
    <table>
        <thead>
            <tr>
                <th>CPU (Núcleos Físicos)</th>
                <th>CPU (Núcleos Lógicos)</th>
                <th>Memória Total (GB)</th>
                <th>Disco Total (GB)</th>
                <th>Disco Usado (GB)</th>
                <th>Disco Livre (GB)</th>
                <th>Uso Disco (%)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $stats['hardware_averages']['cpu']['avg_physical_cores'] ?? '-' }}</td>
                <td>{{ $stats['hardware_averages']['cpu']['avg_logical_cores'] ?? '-' }}</td>
                <td>{{ $stats['hardware_averages']['memory']['avg_total_gb'] ?? '-' }}</td>
                <td>{{ $stats['hardware_averages']['disk']['avg_total_gb'] ?? '-' }}</td>
                <td>{{ $stats['hardware_averages']['disk']['avg_used_gb'] ?? '-' }}</td>
                <td>{{ $stats['hardware_averages']['disk']['avg_free_gb'] ?? '-' }}</td>
                <td>{{ $stats['hardware_averages']['disk']['avg_usage_percent'] ?? '-' }}%</td>
            </tr>
        </tbody>
    </table>
    @if(isset($stats['hardware_averages']['computers_with_hardware_info']))
        <p style="font-size: 9px; color: #666;">Baseado em {{ $stats['hardware_averages']['computers_with_hardware_info'] }} computador(es) com informações de hardware.</p>
    @endif
    @endif

    @if(!empty($stats['os_distribution']))
    <h2>3. Distribuição de Sistemas Operacionais</h2>
    <table>
        <thead>
            <tr>
                <th>Sistema</th>
                <th>Versão</th>
                <th>Quantidade</th>
            </tr>
        </thead>
        <tbody>
            @foreach($stats['os_distribution'] as $os)
                <tr>
                    <td>{{ $os['system'] }}</td>
                    <td>{{ $os['release'] ?? '-' }}</td>
                    <td>{{ $os['count'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    <h2>4. Lista de Computadores</h2>
    <table>
        <thead>
            <tr>
                <th>Hostname</th>
                <th>ID da Máquina</th>
                <th>Status</th>
                <th>Última Atualização</th>
            </tr>
        </thead>
        <tbody>
            @foreach($computers as $computer)
                @php $isOnline = now()->diffInMinutes($computer->updated_at) < 5; @endphp
                <tr>
                    <td>{{ $computer->hostname ?? '-' }}</td>
                    <td style="font-family: monospace; font-size: 9px;">{{ $computer->machine_id }}</td>
                    <td class="{{ $isOnline ? 'status-online' : 'status-offline' }}">{{ $isOnline ? 'Online' : 'Offline' }}</td>
                    <td>{{ $computer->updated_at->format('d/m/Y H:i:s') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <h2>5. Softwares Instalados no Laboratório</h2>
    <table>
        <thead>
            <tr>
                <th>Nome</th>
                <th>Versão</th>
                <th>Fabricante</th>
                <th>Computadores</th>
            </tr>
        </thead>
        <tbody>
            @foreach($softwares as $software)
                <tr>
                    <td>{{ $software->name }}</td>
                    <td>{{ $software->version ?? '-' }}</td>
                    <td>{{ $software->vendor ?? '-' }}</td>
                    <td>{{ $software->computers_count ?? 0 }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <h2>6. Mapa Visual</h2>
    @if(!empty($mapSvgDataUri))
    <div style="margin: 15px 0;">
        <img src="{{ $mapSvgDataUri }}" alt="Mapa do laboratório" style="width: 100%; max-width: 560px; height: auto; display: block; border: 1px solid #ddd; border-radius: 4px;" />
    </div>
    @endif

    <div class="footer">
        <div>iFLab Coletty - Sistema de Gerenciamento de Laboratórios</div>
        <div>Gerado em {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
    </div>
</body>
</html>
