# Guia de Deploy

Este guia fornece instruções para fazer deploy do sistema em produção.

## Pré-requisitos

- Servidor com Docker e Docker Compose
- Domínio configurado (opcional, mas recomendado)
- Certificado SSL (Let's Encrypt recomendado)
- Backup do banco de dados configurado

## Configuração de Produção

### 1. Variáveis de Ambiente

Crie um arquivo `.env` de produção com:

```env
APP_NAME="IFG Lab Manager"
APP_ENV=production
APP_KEY=base64:... # Gere uma chave única
APP_DEBUG=false
APP_URL=https://seu-dominio.com
FRONTEND_URL=https://seu-dominio.com

DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=app_production
DB_USERNAME=usuario_seguro
DB_PASSWORD=senha_muito_segura

REDIS_HOST=redis
REDIS_PASSWORD=senha_redis_segura
REDIS_PORT=6379

# Configurações de email (para notificações)
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=usuario@example.com
MAIL_PASSWORD=senha
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@example.com
MAIL_FROM_NAME="${APP_NAME}"
```

### 2. Segurança

#### Gerar Chave da Aplicação

```bash
docker compose exec app php artisan key:generate
```

#### Configurar Permissões

```bash
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### 3. Otimizações

```bash
# Cache de configuração
docker compose exec app php artisan config:cache

# Cache de rotas
docker compose exec app php artisan route:cache

# Cache de views
docker compose exec app php artisan view:cache

# Otimizar autoloader
docker compose exec app composer install --optimize-autoloader --no-dev
```

### 4. Build do Frontend

```bash
cd frontend
npm install
npm run build
```

## Docker Compose para Produção

Crie um `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    restart: always
    environment:
      APP_ENV: production
      # ... outras variáveis
    volumes:
      - ./backend:/var/www/html
    depends_on:
      - db
      - redis

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/prod.conf:/etc/nginx/conf.d/default.conf
      - ./frontend/dist:/var/www/frontend
      - ./ssl:/etc/nginx/ssl  # Certificados SSL
    depends_on:
      - app

  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: app_production
      POSTGRES_USER: usuario_seguro
      POSTGRES_PASSWORD: senha_muito_segura
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups

  redis:
    image: redis:alpine
    restart: always
    command: redis-server --requirepass senha_redis_segura

volumes:
  postgres_data:
```

## Nginx para Produção

Configure o Nginx com SSL:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    root /var/www/frontend;
    index index.html;

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## Backup

### Backup do Banco de Dados

Crie um script de backup:

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="app_production"

docker compose exec -T db pg_dump -U usuario_seguro $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

Configure cron:

```cron
0 2 * * * /path/to/backup.sh
```

## Monitoramento

### Logs

```bash
# Ver logs do Laravel
docker compose logs -f app

# Ver logs do Nginx
docker compose logs -f nginx
```

### Health Check

O endpoint `/api/up` pode ser usado para health checks:

```bash
curl https://seu-dominio.com/api/up
```

## Atualizações

### Processo de Atualização

1. **Backup**: Faça backup do banco de dados
2. **Pull**: Atualize o código
3. **Dependências**: Atualize dependências
4. **Migrations**: Execute migrations
5. **Cache**: Limpe e recrie caches
6. **Build**: Reconstrua o frontend
7. **Restart**: Reinicie os serviços

```bash
# Script de atualização
./deploy.sh
```

### Rollback

Em caso de problemas:

```bash
# Restaurar backup
docker compose exec db psql -U usuario_seguro app_production < backup.sql

# Voltar para commit anterior
git checkout <commit-anterior>
docker compose up -d --build
```

## Performance

### Otimizações Adicionais

- Use CDN para assets estáticos
- Configure cache do navegador
- Use Redis para sessões e cache
- Configure filas para processamento assíncrono
- Use load balancer se necessário

## Segurança Adicional

- Configure firewall (UFW/iptables)
- Use fail2ban para proteção contra brute force
- Mantenha dependências atualizadas
- Configure rate limiting
- Use HTTPS obrigatório
- Configure CORS adequadamente

## Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] APP_DEBUG=false
- [ ] Chave da aplicação gerada
- [ ] Banco de dados configurado
- [ ] Migrations executadas
- [ ] SSL configurado
- [ ] Backup configurado
- [ ] Monitoramento configurado
- [ ] Logs configurados
- [ ] Testes passando
- [ ] Documentação atualizada

## Suporte

Para questões sobre deploy:
- Consulte os logs
- Verifique a documentação
- Abra uma issue no repositório
