## Guia de Instalação em Servidor Ubuntu (Rede Local)

Este guia descreve um **passo a passo completo** para subir o IFG Lab Manager em um servidor Ubuntu recém-instalado (sem Docker, sem Git, etc.), acessando o sistema pela **rede local via IP**.

> Exemplos usam `SEU_IP_LOCAL` como IP do servidor (por exemplo, `http://10.3.233.50`).

---

## 1. Preparar o servidor Ubuntu

1. **Atualizar o sistema**:

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Instalar utilitários básicos**:

   ```bash
   sudo apt install -y ca-certificates curl gnupg lsb-release git vim ufw
   ```

3. **(Opcional, mas recomendado) Configurar hostname e IP fixo**:

   - Ajuste `/etc/hostname` e `/etc/hosts` conforme o padrão da sua rede.
   - Configure IP estático via Netplan, se necessário (isso depende do ambiente e da política de rede da instituição).

---

## 2. Instalar Docker e Docker Compose

1. **Adicionar chave GPG e repositório Docker** (oficial):

   ```bash
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo \
     "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
     $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

   sudo apt update
   ```

2. **Instalar Docker Engine + plugins**:

   ```bash
   sudo apt install -y \
     docker-ce docker-ce-cli containerd.io \
     docker-buildx-plugin docker-compose-plugin
   ```

3. **Habilitar e testar Docker**:

   ```bash
   sudo systemctl enable --now docker
   sudo docker run hello-world
   ```

4. **(Opcional) Adicionar seu usuário ao grupo `docker`**:

   ```bash
   sudo usermod -aG docker $USER
   # Faça logout/login para o grupo surtir efeito
   ```

5. **Verificar Docker Compose plugin**:

   ```bash
   docker compose version
   ```

---

## 3. Obter o código do projeto

1. **Escolher diretório e clonar o repositório**:

   ```bash
   cd /opt
   sudo git clone <URL_DO_REPOSITORIO> iflabcoletty
   cd iflabcoletty
   sudo chown -R $USER:$USER .
   ```

2. **Conferir estrutura** (opcional):

   - Devem existir os diretórios: `backend/`, `frontend/`, `docker/`, `docs/`, `agent/`.

---

## 4. Configurar o backend (Laravel)

1. **Criar `.env` do backend** (em `backend/.env`):

   ```bash
   cd /opt/iflabcoletty/backend
   cp .env.example .env    # se o arquivo .env.example existir
   ```

   Edite o `.env` e ajuste as variáveis principais:

   ```env
   APP_NAME="IFG Lab Manager"
   APP_ENV=production      # ou local, se for ambiente de testes interno
   APP_DEBUG=false
   APP_URL=http://SEU_IP_LOCAL
   FRONTEND_URL=http://SEU_IP_LOCAL

   DB_CONNECTION=pgsql
   DB_HOST=db
   DB_PORT=5432
   DB_DATABASE=app
   DB_USERNAME=user
   DB_PASSWORD=password

   REDIS_HOST=redis
   REDIS_PASSWORD=null
   REDIS_PORT=6379
   ```

2. **Subir containers base (banco e redis)**:

   ```bash
   cd /opt/iflabcoletty
   docker compose up -d db redis
   # ou, se preferir já subir tudo de uma vez:
   # docker compose up -d
   ```

3. **Instalar dependências do backend (no container `app`)**:

   ```bash
   docker compose exec app composer install --no-dev --optimize-autoloader
   ```

4. **Gerar chave da aplicação Laravel**:

   ```bash
   docker compose exec app php artisan key:generate
   ```

5. **Executar migrações do banco**:

   ```bash
   docker compose exec app php artisan migrate --force
   ```

---

## 5. Configurar e buildar o frontend

1. **Instalar Node.js + npm no host (se ainda não tiver)**:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. **Instalar dependências do frontend**:

   ```bash
   cd /opt/iflabcoletty/frontend
   npm install
   ```

3. **Build de produção do frontend**:

   ```bash
   npm run build
   ```

   - Isso gera o diretório `frontend/dist`, que será servido pelo Nginx do Docker (conforme as configs em `docker/nginx/`).

---

## 6. Subir a stack com Docker Compose

1. **Verificar `docker-compose.yml`** (já fornecido pelo projeto):

   - Serviços esperados: `app`, `nginx`, `db`, `redis`, possivelmente `node`/`scheduler`.
   - Portas típicas:
     - Nginx: `80:80` (frontend + proxy para API Laravel).

2. **Subir tudo**:

   ```bash
   cd /opt/iflabcoletty
   docker compose up -d --build   # primeira vez
   # depois das primeiras builds, basta:
   # docker compose up -d
   ```

3. **Verificar se os containers estão no ar**:

   ```bash
   docker compose ps
   ```

---

## 7. Testar o acesso na rede local

1. **Frontend / painel admin**:

   - Em qualquer máquina da mesma rede, abra no navegador:

     ```text
     http://SEU_IP_LOCAL
     ```

2. **API health check**:

   - No próprio servidor ou de outra máquina:

     ```bash
     curl http://SEU_IP_LOCAL/api/up
     ```

   - A resposta esperada é algo como:

     ```json
     {"status":"ok"}
     ```

3. **Página pública de computador** (depois que houver computadores cadastrados):

   - A rota pública é:

     ```text
     http://SEU_IP_LOCAL/public/pc/<hash_gerado>
     ```

   - O `<hash_gerado>` vem do campo `public_hash` do computador (exposto pelo painel admin).

---

## 8. Criar usuário administrador inicial

1. **Entrar no Tinker do Laravel**:

   ```bash
   cd /opt/iflabcoletty
   docker compose exec app php artisan tinker
   ```

2. **Criar usuário** (exemplo básico):

   ```php
   use App\Models\User;
   use Illuminate\Support\Facades\Hash;

   $user = new User();
   $user->name = 'Admin';
   $user->email = 'admin@example.com';
   $user->password = Hash::make('senha-segura');
   $user->save();
   ```

3. **Login**:

   - Acesse `http://SEU_IP_LOCAL` e faça login com:
     - E-mail: `admin@example.com`
     - Senha: `senha-segura` (ou a que você definiu).

---

## 9. Ajustes de produção mínimos (mesmo em rede local)

1. **Permissões em `storage/` e `bootstrap/cache/`**:

   ```bash
   cd /opt/iflabcoletty
   docker compose exec app chmod -R 755 storage bootstrap/cache
   docker compose exec app chown -R www-data:www-data storage bootstrap/cache
   ```

2. **Otimizações Laravel** (recomendado se o servidor já for o ambiente definitivo):

   ```bash
   docker compose exec app php artisan config:cache
   docker compose exec app php artisan route:cache
   docker compose exec app php artisan view:cache
   ```

3. **Firewall (UFW) básico para rede local** (opcional, mas recomendado):

   ```bash
   sudo ufw allow ssh
   sudo ufw allow 80/tcp
   sudo ufw enable
   ```

---

## 10. Resumo rápido dos comandos principais

1. **No servidor recém-instalado**:

   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y ca-certificates curl gnupg lsb-release git vim ufw
   # instalar Docker + plugins (ver seção 2)
   # instalar Node.js (ver seção 5)
   ```

2. **Clonar projeto**:

   ```bash
   cd /opt
   sudo git clone <URL_DO_REPOSITORIO> iflabcoletty
   cd iflabcoletty
   sudo chown -R $USER:$USER .
   ```

3. **Configurar `.env` do backend**:

   ```bash
   cd backend
   cp .env.example .env
   # editar APP_URL e FRONTEND_URL para http://SEU_IP_LOCAL
   ```

4. **Subir stack**:

   ```bash
   cd /opt/iflabcoletty
   docker compose up -d --build
   ```

5. **Instalar backend + gerar chave + migrar**:

   ```bash
   docker compose exec app composer install --no-dev --optimize-autoloader
   docker compose exec app php artisan key:generate
   docker compose exec app php artisan migrate --force
   ```

6. **Build do frontend**:

   ```bash
   cd frontend
   npm install
   npm run build
   ```

7. **Acessar o sistema**:

   - Painel admin: `http://SEU_IP_LOCAL`
   - Health check: `http://SEU_IP_LOCAL/api/up`

