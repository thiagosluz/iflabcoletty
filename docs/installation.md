# Guia de Instalação

Este guia fornece instruções detalhadas para instalar e configurar o sistema IFG Lab Manager.

## Pré-requisitos

- Docker e Docker Compose instalados
- Git
- Pelo menos 4GB de RAM disponível
- Portas 80, 8000 disponíveis (ou configurar outras)

## Instalação com Docker

### 1. Clonar o repositório

```bash
git clone <repository-url>
cd iflabcoletty
```

### 2. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` (se existir) ou crie um novo arquivo `.env` no diretório `backend/`:

```bash
cd backend
cp .env.example .env  # Se existir
```

Edite o arquivo `.env` e configure as seguintes variáveis:

```env
APP_NAME="IFG Lab Manager"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost
FRONTEND_URL=http://localhost

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

### 3. Instalar dependências do backend

Execute dentro do container Docker:

```bash
docker compose exec app composer install
```

### 4. Gerar chave da aplicação

```bash
docker compose exec app php artisan key:generate
```

### 5. Executar migrações

```bash
docker compose exec app php artisan migrate
```

### 6. Instalar dependências do frontend

```bash
cd frontend
npm install
```

### 7. Construir o frontend

```bash
npm run build
```

### 8. Iniciar os serviços

```bash
docker compose up -d
```

## Verificação da Instalação

1. Acesse `http://localhost` para verificar se o frontend está funcionando
2. Acesse `http://localhost:8000/api/up` para verificar se a API está respondendo
3. Acesse `http://localhost/api/documentation` para ver a documentação Swagger (após configurar)

## Configuração do Swagger

Após instalar as dependências, execute:

```bash
docker compose exec app php artisan l5-swagger:generate
```

A documentação estará disponível em `/api/documentation`.

## Criar usuário administrador

Para criar o primeiro usuário administrador, você pode usar o tinker:

```bash
docker compose exec app php artisan tinker
```

No tinker:

```php
$user = new App\Models\User();
$user->name = 'Admin';
$user->email = 'admin@example.com';
$user->password = Hash::make('senha-segura');
$user->save();
```

## Próximos Passos

- Consulte o [Guia de Desenvolvimento](development.md) para informações sobre desenvolvimento
- Veja a [Documentação da API](api.md) para entender os endpoints disponíveis
- Leia o [Guia de Testes](testing.md) para executar os testes
