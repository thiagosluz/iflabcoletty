<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório Resumido - {{ $lab->name }}</title>
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
        .stats-grid { display: table; width: 100%; margin: 15px 0; }
        .stats-grid .stat { display: table-cell; padding: 10px; text-align: center; border: 1px solid #ddd; }
        .compact-line { margin: 8px 0; font-size: 11px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Relatório Resumido - {{ $lab->name }}</h1>
        <div class="header-info">
            @if($lab->description)
                <div>{{ $lab->description }}</div>
            @endif
            <div>Data de Exportação: {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
        </div>
    </div>

    <h2>Resumo</h2>
    <div class="stats-grid">
        <div class="stat">Total de Computadores: <strong>{{ $stats['total_computers'] }}</strong></div>
        <div class="stat">Online: <strong>{{ $stats['online_computers'] }}</strong></div>
        <div class="stat">Offline: <strong>{{ $stats['offline_computers'] }}</strong></div>
        <div class="stat">Softwares Únicos: <strong>{{ $stats['total_softwares'] }}</strong></div>
    </div>

    @if($stats['hardware_averages'])
    <h2>Médias de Configuração (resumo)</h2>
    <div class="compact-line">
        CPU: {{ $stats['hardware_averages']['cpu']['avg_physical_cores'] ?? '-' }} núcleos físicos / {{ $stats['hardware_averages']['cpu']['avg_logical_cores'] ?? '-' }} lógicos
        &nbsp;|&nbsp; Memória: {{ $stats['hardware_averages']['memory']['avg_total_gb'] ?? '-' }} GB (média)
        &nbsp;|&nbsp; Disco: {{ $stats['hardware_averages']['disk']['avg_total_gb'] ?? '-' }} GB total, {{ $stats['hardware_averages']['disk']['avg_usage_percent'] ?? '-' }}% uso (média)
    </div>
    @if(isset($stats['hardware_averages']['computers_with_hardware_info']))
        <p style="font-size: 9px; color: #666;">Baseado em {{ $stats['hardware_averages']['computers_with_hardware_info'] }} computador(es) com informações de hardware.</p>
    @endif
    @endif

    @if(!empty($stats['os_distribution']))
    <h2>Distribuição de Sistemas Operacionais</h2>
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

    <h2>Contagens</h2>
    <div class="compact-line">Computadores listados: <strong>{{ $computers->count() }}</strong></div>
    <div class="compact-line">Softwares instalados no laboratório: <strong>{{ $softwares->count() }}</strong></div>

    <div class="footer">
        <div>iFLab Coletty - Sistema de Gerenciamento de Laboratórios</div>
        <div>Gerado em {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
    </div>
</body>
</html>
