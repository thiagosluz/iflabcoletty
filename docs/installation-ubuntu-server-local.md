## Guia de Instalação em Servidor Ubuntu (Rede Local)

Este guia descreve um **passo a passo completo** para subir o IFG Lab Manager em um servidor Ubuntu recém-instalado (sem Docker, sem Git, etc.), acessando o sistema pela **rede local via IP**.

> Exemplos usam `SEU_IP_LOCAL` como IP do servidor (por exemplo, `http://10.3.233.50`).

### Ordem recomendada (visão geral)

Para a aplicação subir sem erros (502, 403, falta de `vendor` ou RoadRunner), siga esta ordem:

1. **Preparar servidor** → instalar Docker e dependências.
2. **Clonar o projeto** e configurar o `.env` do backend.
3. **Subir apenas `db` e `redis`** — não subir o `app` ainda.
4. **Instalar dependências do backend** com container temporário: `docker compose run --rm app composer install ...`.
5. **Gerar chave Laravel**, **rodar migrações** e **seed de roles e permissões** (para evitar 403).
6. **Build do frontend** no host (ou ajustar permissões do `dist/` se usar container).
7. **Subir a stack completa** (`docker compose up -d`) e **verificar se o Octane está rodando**.
8. **Criar/ajustar usuário admin** e testar o acesso.

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

2. **Subir apenas os containers de infraestrutura (banco e redis)**:

   Não suba o `app` ainda — ele depende do `vendor/` e do RoadRunner; se subir antes de instalar dependências, o container entra em loop de reinício.

   ```bash
   cd /opt/iflabcoletty
   docker compose up -d db redis
   ```

   Aguarde alguns segundos e confira: `docker compose ps` (apenas `db` e `redis` devem estar "Up").

3. **Instalar dependências do backend com container temporário**:

   Use um container **temporário** só para rodar o Composer. Assim não é preciso ter o `app` rodando (evita erro de "vendor/autoload.php not found" e loop de restart):

   ```bash
   cd /opt/iflabcoletty
   docker compose run --rm app composer install --no-dev --optimize-autoloader
   ```

   O `--rm` remove o container ao final; a pasta `backend/vendor/` fica no host (via volume) e será usada quando o `app` subir.

4. **Gerar chave da aplicação Laravel** (ainda com container temporário):

   ```bash
   docker compose run --rm app php artisan key:generate
   ```

5. **Executar migrações do banco**:

   ```bash
   docker compose run --rm app php artisan migrate --force
   ```

6. **Seed de roles e permissões** (obrigatório para evitar 403 Forbidden):

   O sistema usa **Spatie Laravel Permission**. Sem o seed, não existem permissões nem roles; qualquer rota protegida retorna 403.

   ```bash
   docker compose run --rm app php artisan db:seed --class=RolePermissionSeeder
   ```

   Isso cria as permissões (ex.: `labs.view`, `dashboard.view`, `users.view`) e as roles `admin`, `technician`, `professor`, `viewer`, e atribui todas as permissões à role `admin`. Se existir usuário com e-mail `admin@iflab.com`, ele recebe a role `admin`.

   **(Opcional)** Se quiser criar também o usuário admin padrão e dados de exemplo (labs, softwares, computadores):

   ```bash
   docker compose run --rm app php artisan db:seed
   ```

   Em produção, muitas vezes basta o `RolePermissionSeeder`; depois você cria seu usuário e atribui a role `admin` (ver seção 8).

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

   Isso gera o diretório `frontend/dist`, que será servido pelo Nginx do Docker (conforme as configs em `docker/nginx/`).

   **Se aparecer erro de permissão** (ex.: `EACCES: permission denied, copyfile ... -> .../dist/`), o `dist/` ou `node_modules/` podem estar com dono root. Ajuste e tente de novo:

   ```bash
   sudo chown -R $USER:$USER /opt/iflabcoletty/frontend/dist /opt/iflabcoletty/frontend/node_modules
   # ou, se dist não existir ainda:
   sudo rm -rf dist && mkdir -p dist && npm run build
   ```

---

## 6. Subir a stack com Docker Compose

1. **Verificar `docker-compose.yml`** (já fornecido pelo projeto):

   - Serviços esperados: `app`, `nginx`, `db`, `redis`, `scheduler`, `queue-worker`, `reverb`, possivelmente `node`.
   - Portas típicas: Nginx `80:80`, app (Octane) `8000:8000`, Reverb `8080:8080`.

2. **Subir a stack completa** (só depois de ter rodado composer, migrate e seed conforme a seção 4):

   ```bash
   cd /opt/iflabcoletty
   docker compose up -d --build   # primeira vez (builda imagens e sobe todos os serviços)
   # nas próximas vezes:
   # docker compose up -d
   ```

3. **Verificar se os containers estão no ar**:

   ```bash
   docker compose ps
   ```

   Todos os serviços devem estar "Up" (ou "running"). Se o `app` estiver em "restarting", veja os logs: `docker compose logs app --tail=50`.

4. **Verificar se o Octane (RoadRunner) está rodando**:

   O backend usa Laravel Octane com RoadRunner. O binário `rr` fica em `/usr/local/bin/rr` dentro do container (fora do volume) para não ser sobrescrito.

   ```bash
   # Binário RoadRunner presente e no PATH
   docker compose exec app which rr
   docker compose exec app rr --version

   # Status do servidor Octane
   docker compose exec app php artisan octane:status
   ```

   Saída esperada de `octane:status`: indica que o servidor Octane está rodando. Se aparecer "Octane server is not running", o container `app` pode estar crashando — confira `docker compose logs app`.

   **Teste rápido da API** (confirma que o Nginx está repassando para o app):

   ```bash
   curl -s http://SEU_IP_LOCAL/api/up
   # ou, no próprio servidor:
   curl -s http://localhost/api/up
   ```

   Deve retornar algo como `{"status":"ok"}`. Se retornar 502 Bad Gateway, o app não está atendendo; verifique logs do `app` e do `nginx`.

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

Se você **não** rodou `php artisan db:seed` (que cria o usuário `admin@iflab.com` com senha `password`), crie um usuário e atribua a role `admin` para evitar 403.

1. **Entrar no Tinker do Laravel**:

   ```bash
   cd /opt/iflabcoletty
   docker compose exec app php artisan tinker
   ```

2. **Criar usuário e atribuir role admin**:

   ```php
   use App\Models\User;
   use Illuminate\Support\Facades\Hash;

   $user = new User();
   $user->name = 'Admin';
   $user->email = 'admin@example.com';
   $user->password = Hash::make('senha-segura');
   $user->save();

   // Atribuir role admin (necessário para acessar o painel sem 403)
   $user->assignRole('admin');
   $user->getRoleNames(); // conferir: deve listar "admin"
   exit
   ```

3. **Se o usuário já existir** (por exemplo criado por outro seeder), apenas atribua a role:

   ```bash
   docker compose exec app php artisan tinker
   ```

   ```php
   $user = \App\Models\User::where('email', 'seu-email@exemplo.com')->first();
   $user->assignRole('admin');
   exit
   ```

4. **(Opcional) Limpar cache de permissões** após alterar roles:

   ```bash
   docker compose exec app php artisan permission:cache-reset
   # ou, se o comando não existir:
   docker compose exec app php artisan cache:clear
   ```

5. **Login**:

   - Acesse `http://SEU_IP_LOCAL` e faça login com o e-mail e senha do usuário que possui a role `admin`.

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

## 10. Resumo rápido dos comandos principais (ordem de prioridade)

1. **Preparar servidor** (Docker, Node.js — seções 1, 2, 5.1):

   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y ca-certificates curl gnupg lsb-release git vim ufw
   # instalar Docker + plugins (seção 2)
   # instalar Node.js (seção 5)
   ```

2. **Clonar e configurar**:

   ```bash
   cd /opt
   sudo git clone <URL_DO_REPOSITORIO> iflabcoletty
   cd iflabcoletty
   sudo chown -R $USER:$USER .
   cd backend && cp .env.example .env
   # editar .env: APP_URL e FRONTEND_URL = http://SEU_IP_LOCAL
   ```

3. **Subir só db e redis** (não subir o app ainda):

   ```bash
   cd /opt/iflabcoletty
   docker compose up -d db redis
   ```

4. **Backend com container temporário** (composer, chave, migrar, seed):

   ```bash
   docker compose run --rm app composer install --no-dev --optimize-autoloader
   docker compose run --rm app php artisan key:generate
   docker compose run --rm app php artisan migrate --force
   docker compose run --rm app php artisan db:seed --class=RolePermissionSeeder
   ```

5. **Build do frontend**:

   ```bash
   cd /opt/iflabcoletty/frontend
   npm install
   npm run build
   ```

   Se der erro de permissão em `dist/`, ajuste: `sudo chown -R $USER:$USER dist node_modules`.

6. **Subir a stack completa e verificar Octane**:

   ```bash
   cd /opt/iflabcoletty
   docker compose up -d --build
   docker compose ps
   docker compose exec app which rr && docker compose exec app php artisan octane:status
   curl -s http://SEU_IP_LOCAL/api/up
   ```

7. **Criar usuário admin** (se não usou `db:seed` completo):

   ```bash
   docker compose exec app php artisan tinker
   # criar usuário e $user->assignRole('admin');
   ```

8. **Acessar o sistema**:

   - Painel admin: `http://SEU_IP_LOCAL`
   - Health check: `http://SEU_IP_LOCAL/api/up`

