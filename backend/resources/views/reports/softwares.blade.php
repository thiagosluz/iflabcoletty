<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório de Softwares</title>
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
        }

        th {
            background-color: #f3f4f6;
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
        }

        td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 11px;
        }

        tr:nth-child(even) {
            background-color: #f9fafb;
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
        <h1>Relatório de Softwares</h1>
        <div class="header-info">
            <div>Total de Softwares: {{ $totalSoftwares ?? count($softwares) }}</div>
            <div>Data de Exportação: {{ $exportDate ?? now()->format('d/m/Y H:i:s') }}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Versão</th>
                <th>Fabricante</th>
                <th>Total de Computadores</th>
                <th>Data de Criação</th>
            </tr>
        </thead>
        <tbody>
            @foreach($softwares as $software)
                <tr>
                    <td>{{ $software->id }}</td>
                    <td>{{ $software->name }}</td>
                    <td>{{ $software->version ?? '-' }}</td>
                    <td>{{ $software->vendor ?? '-' }}</td>
                    <td>{{ $software->computers_count ?? 0 }}</td>
                    <td>{{ $software->created_at->format('d/m/Y H:i:s') }}</td>
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
