# Guia de Instalação do Agente IFG Lab Manager

Este guia explica como instalar o agente do IFG Lab Manager como um serviço do sistema em Linux e Windows.

## 📋 Pré-requisitos

### Linux
- Python 3.8 ou superior
- `python3-venv` e `python3-pip`
- Acesso root (sudo) para instalação do serviço
- systemd (presente na maioria das distribuições modernas)

### Windows
- Python 3.8 ou superior
- PowerShell 5.1 ou superior (já incluído no Windows 10/11)
- Acesso de Administrador
- NSSM (Non-Sucking Service Manager) - será baixado automaticamente pelo script

## 🐧 Instalação no Linux

### Passo 1: Preparar o ambiente

1. Clone ou copie o diretório do agente para o computador onde será instalado:
   ```bash
   # Exemplo: copiar para /opt/iflab-agent
   sudo mkdir -p /opt/iflab-agent
   sudo cp -r agent/* /opt/iflab-agent/
   cd /opt/iflab-agent
   ```

2. Torne o script de instalação executável:
   ```bash
   sudo chmod +x install_linux.sh
   ```

### Passo 2: Executar a instalação

Execute o script de instalação como root:
```bash
sudo ./install_linux.sh
```

O script irá:
- Verificar se Python 3.8+ está instalado
- Criar um usuário de serviço (`iflab`)
- Criar um ambiente virtual Python
- Instalar as dependências do agente
- Criar e configurar o serviço systemd
- Habilitar o serviço para iniciar automaticamente

### Passo 3: Configurar o agente

Antes de iniciar o serviço, você precisa configurar as variáveis de ambiente. Edite o arquivo do serviço:

```bash
sudo systemctl edit iflab-agent
```

Ou edite diretamente:
```bash
sudo nano /etc/systemd/system/iflab-agent.service
```

Adicione as seguintes linhas na seção `[Service]`:

```ini
[Service]
Environment="API_BASE_URL=http://seu-servidor:8000/api/v1"
Environment="LAB_ID=1"
Environment="AGENT_EMAIL=admin@iflab.com"
Environment="AGENT_PASSWORD=sua-senha"
Environment="LOG_LEVEL=INFO"
```

**Alternativa:** Você também pode criar um arquivo `.env` no diretório do agente:
```bash
sudo nano /opt/iflab-agent/.env
```

```env
API_BASE_URL=http://seu-servidor:8000/api/v1
LAB_ID=1
AGENT_EMAIL=admin@iflab.com
AGENT_PASSWORD=sua-senha
LOG_LEVEL=INFO
```

### Passo 4: Iniciar o serviço

```bash
# Recarregar configuração do systemd
sudo systemctl daemon-reload

# Iniciar o serviço
sudo systemctl start iflab-agent

# Verificar status
sudo systemctl status iflab-agent

# Habilitar inicialização automática (já feito pelo script)
sudo systemctl enable iflab-agent
```

### Passo 5: Verificar logs

```bash
# Ver logs em tempo real
sudo journalctl -u iflab-agent -f

# Ver últimas 100 linhas
sudo journalctl -u iflab-agent -n 100
```

## 🪟 Instalação no Windows

### Passo 1: Preparar o ambiente

1. Abra PowerShell como **Administrador** (clique com botão direito → "Executar como administrador")

2. Navegue até o diretório do agente:
   ```powershell
   cd C:\caminho\para\agent
   ```

3. Verifique se a execução de scripts está habilitada:
   ```powershell
   Get-ExecutionPolicy
   ```
   
   Se retornar `Restricted`, execute:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Passo 2: Executar a instalação

Execute o script de instalação:
```powershell
.\install_windows.ps1
```

O script irá:
- Verificar se Python está instalado
- Baixar e instalar NSSM (se necessário)
- Criar um ambiente virtual Python
- Instalar as dependências do agente
- Criar e configurar o serviço Windows
- Configurar reinicialização automática em caso de falha

### Passo 3: Configurar o agente

Configure as variáveis de ambiente usando o NSSM:

**Opção 1: Usando interface gráfica do NSSM**
```powershell
# Abrir interface gráfica do NSSM
& "C:\caminho\para\nssm\nssm.exe" edit IFLabAgent
```

Na aba "Application", adicione as variáveis de ambiente na seção "Environment" ou use a aba "Environment".

**Opção 2: Usando linha de comando**
```powershell
$nssmPath = "C:\caminho\para\nssm\nssm.exe"  # Ajuste conforme necessário

& $nssmPath set IFLabAgent AppEnvironmentExtra "API_BASE_URL=http://seu-servidor:8000/api/v1"
& $nssmPath set IFLabAgent AppEnvironmentExtra "LAB_ID=1"
& $nssmPath set IFLabAgent AppEnvironmentExtra "AGENT_EMAIL=admin@iflab.com"
& $nssmPath set IFLabAgent AppEnvironmentExtra "AGENT_PASSWORD=sua-senha"
& $nssmPath set IFLabAgent AppEnvironmentExtra "LOG_LEVEL=INFO"
```

**Alternativa:** Crie um arquivo `.env` no diretório do agente:
```powershell
@"
API_BASE_URL=http://seu-servidor:8000/api/v1
LAB_ID=1
AGENT_EMAIL=admin@iflab.com
AGENT_PASSWORD=sua-senha
LOG_LEVEL=INFO
"@ | Out-File -FilePath ".env" -Encoding utf8
```

### Passo 4: Iniciar o serviço

```powershell
# Iniciar o serviço
Start-Service IFLabAgent

# Verificar status
Get-Service IFLabAgent

# Ver logs
Get-Content C:\caminho\para\agent\logs\service.log -Tail 50 -Wait
```

## 🔄 Atualização Automática

O agente inclui um script de atualização automática (`update.py`) que verifica e baixa atualizações do servidor.

### Configuração

1. Configure a variável de ambiente `AGENT_TOKEN` (opcional, para autenticação):
   ```bash
   # Linux
   export AGENT_TOKEN=seu-token
   
   # Windows
   $env:AGENT_TOKEN="seu-token"
   ```

2. Execute o script de atualização:
   ```bash
   # Linux
   python3 update.py
   
   # Windows
   python update.py
   ```

### Atualização Automática (Não Interativa)

Para atualizações automáticas sem interação (útil em cron jobs ou tarefas agendadas):

```bash
# Linux - Adicionar ao crontab
AUTO_UPDATE=1 python3 /opt/iflab-agent/update.py

# Windows - Tarefa Agendada
$env:AUTO_UPDATE="1"; python C:\caminho\para\agent\update.py
```

### Agendamento de Verificação de Atualizações

**Linux (crontab):**
```bash
# Verificar atualizações diariamente às 2h da manhã
0 2 * * * cd /opt/iflab-agent && AUTO_UPDATE=1 /opt/iflab-agent/.venv/bin/python update.py >> /var/log/iflab-agent-update.log 2>&1
```

**Windows (Task Scheduler):**
1. Abra o Agendador de Tarefas
2. Crie uma nova tarefa
3. Configure para executar diariamente
4. Ação: `powershell.exe`
5. Argumentos: `-Command "cd C:\caminho\para\agent; $env:AUTO_UPDATE='1'; python update.py"`

## 🛠️ Comandos Úteis

### Linux

```bash
# Gerenciar serviço
sudo systemctl start iflab-agent      # Iniciar
sudo systemctl stop iflab-agent       # Parar
sudo systemctl restart iflab-agent    # Reiniciar
sudo systemctl status iflab-agent     # Status
sudo systemctl enable iflab-agent     # Habilitar no boot
sudo systemctl disable iflab-agent    # Desabilitar no boot

# Logs
sudo journalctl -u iflab-agent -f     # Seguir logs
sudo journalctl -u iflab-agent -n 100 # Últimas 100 linhas
sudo journalctl -u iflab-agent --since "1 hour ago" # Última hora

# Desinstalar
sudo systemctl stop iflab-agent
sudo systemctl disable iflab-agent
sudo rm /etc/systemd/system/iflab-agent.service
sudo systemctl daemon-reload
```

### Windows

```powershell
# Gerenciar serviço
Start-Service IFLabAgent              # Iniciar
Stop-Service IFLabAgent               # Parar
Restart-Service IFLabAgent            # Reiniciar
Get-Service IFLabAgent                # Status

# Logs
Get-Content C:\caminho\para\agent\logs\service.log -Tail 50 -Wait

# Desinstalar
Stop-Service IFLabAgent
& "C:\caminho\para\nssm\nssm.exe" remove IFLabAgent confirm
```

## 🔍 Solução de Problemas

### Linux

**Serviço não inicia:**
```bash
# Verificar logs detalhados
sudo journalctl -u iflab-agent -n 50

# Verificar permissões
ls -la /opt/iflab-agent
sudo chown -R iflab:iflab /opt/iflab-agent

# Testar manualmente
sudo -u iflab /opt/iflab-agent/.venv/bin/python /opt/iflab-agent/main.py
```

**Erro de autenticação:**
- Verifique se `AGENT_EMAIL` e `AGENT_PASSWORD` estão corretos
- Verifique se a URL da API está acessível
- Verifique se o usuário existe no sistema

**Erro de conexão:**
- Verifique se `API_BASE_URL` está correto
- Teste conectividade: `curl http://seu-servidor:8000/api/v1`
- Verifique firewall

### Windows

**Serviço não inicia:**
```powershell
# Verificar logs
Get-Content C:\caminho\para\agent\logs\service_error.log

# Verificar configuração do serviço
& "C:\caminho\para\nssm\nssm.exe" status IFLabAgent

# Testar manualmente
cd C:\caminho\para\agent
.\.venv\Scripts\python.exe main.py
```

**NSSM não encontrado:**
- O script tenta baixar automaticamente
- Se falhar, baixe manualmente de https://nssm.cc/download
- Extraia para `C:\caminho\para\agent\nssm`

**Erro de permissões:**
- Certifique-se de executar PowerShell como Administrador
- Verifique se o usuário do serviço tem permissões adequadas

## 📝 Notas Importantes

1. **Segurança**: Nunca commite credenciais no código. Use variáveis de ambiente ou arquivos `.env` (que devem estar no `.gitignore`).

2. **Firewall**: Certifique-se de que o agente pode acessar o servidor na porta configurada (geralmente 8000).

3. **Backup**: O script de atualização cria backups automáticos em `agent/backups/`.

4. **Versão**: A versão atual do agente é armazenada em `.agent_version`.

5. **Logs**: Os logs são importantes para diagnóstico. Monitore regularmente.

## 🔗 Links Úteis

- [Documentação do Systemd](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [NSSM Documentation](https://nssm.cc/usage)
- [Python venv Documentation](https://docs.python.org/3/library/venv.html)

## 📞 Suporte

Em caso de problemas, verifique:
1. Os logs do serviço
2. A conectividade com o servidor
3. As configurações de ambiente
4. A documentação do projeto

Para mais informações, consulte a [documentação principal](../README.md).
