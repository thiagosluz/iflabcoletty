# Arquitetura do Sistema

Este documento descreve a arquitetura geral do sistema IFG Lab Manager.

## Visão Geral

O sistema é composto por três componentes principais:

1. **Backend (Laravel)** - API RESTful
2. **Frontend (React)** - Interface web
3. **Agent (Python)** - Agente de coleta de dados

## Diagrama de Arquitetura

```
┌─────────────┐
│   Frontend  │
│   (React)   │
└──────┬──────┘
       │ HTTP/REST
       │
┌──────▼──────┐
│   Backend   │
│  (Laravel)  │
└──────┬──────┘
       │
       ├─────────┐
       │         │
┌──────▼──────┐ ┌▼──────────┐
│ PostgreSQL  │ │  Redis    │
└─────────────┘ └───────────┘
       │
       │
┌──────▼──────┐
│   Agent     │
│  (Python)   │
└─────────────┘
```

## Backend (Laravel)

### Tecnologias

- **Framework**: Laravel 12
- **Banco de Dados**: PostgreSQL
- **Cache/Sessions**: Redis
- **Autenticação**: Laravel Sanctum
- **Servidor**: RoadRunner (Octane)

### Estrutura

```
app/
├── Http/
│   └── Controllers/
│       └── Api/V1/     # Controllers da API
├── Models/              # Models Eloquent
├── Providers/          # Service Providers
└── Console/
    └── Commands/       # Comandos Artisan

database/
├── migrations/         # Migrations do banco
├── factories/          # Factories para testes
└── seeders/            # Seeders

routes/
└── api.php             # Rotas da API
```

### Padrões Utilizados

- **Repository Pattern**: (pode ser implementado)
- **API Resources**: Para formatação de respostas
- **Form Requests**: Para validação
- **Service Classes**: Para lógica de negócio complexa

## Frontend (React)

### Tecnologias

- **Framework**: React 19
- **TypeScript**: Para type safety
- **Roteamento**: React Router
- **Estado**: Zustand
- **UI**: Shadcn UI + Tailwind CSS
- **Formulários**: React Hook Form + Zod
- **HTTP Client**: Axios

### Estrutura

```
src/
├── components/         # Componentes reutilizáveis
├── pages/             # Páginas da aplicação
├── layouts/           # Layouts
├── lib/               # Utilitários
└── store/             # Estado global (Zustand)
```

### Fluxo de Dados

```
Component → API Call → Backend → Database
                ↓
         Response → State Update → UI Update
```

## Agent (Python)

### Tecnologias

- **Linguagem**: Python 3
- **Bibliotecas**: psutil, requests

### Funcionalidades

- Coleta informações de hardware
- Lista softwares instalados
- Envia dados para o backend periodicamente
- Registra o computador no sistema

## Banco de Dados

### Schema Principal

```
labs
├── id
├── name
├── description
└── timestamps

computers
├── id
├── lab_id (FK)
├── machine_id (unique)
├── public_hash
├── hostname
├── hardware_info (JSON)
└── timestamps

softwares
├── id
├── name
├── version
└── vendor

computer_software (pivot)
├── computer_id
├── software_id
└── installed_at

computer_activities
├── id
├── computer_id (FK)
├── type
├── description
├── payload (JSON)
└── timestamps
```

## Autenticação e Autorização

### Autenticação

- Laravel Sanctum com tokens de API
- Tokens armazenados no banco de dados
- Expiração configurável

### Autorização

- Atualmente todos os usuários autenticados têm acesso completo
- Sistema de roles/permissions pode ser implementado

## API Design

### Padrões REST

- URLs semânticas
- Métodos HTTP apropriados
- Status codes corretos
- JSON como formato de dados

### Versionamento

- API versionada: `/api/v1/`
- Facilita evolução sem quebrar clientes

## Segurança

### Implementado

- Autenticação via tokens
- Validação de entrada
- Proteção CSRF (via Sanctum)
- SQL injection protection (Eloquent)

### Recomendações para Produção

- Rate limiting
- HTTPS obrigatório
- CORS configurado
- Logs de auditoria
- Backup automático

## Performance

### Otimizações

- Eager loading de relacionamentos
- Cache com Redis
- Paginação em listagens
- Índices no banco de dados

### Monitoramento

- Logs do Laravel
- Métricas de performance (pode ser implementado)

## Deploy

### Ambiente de Desenvolvimento

- Docker Compose
- Serviços isolados
- Hot reload para desenvolvimento

### Ambiente de Produção

- Servidor web (Nginx)
- PHP-FPM ou RoadRunner
- PostgreSQL
- Redis
- SSL/TLS

## Escalabilidade

### Horizontal

- Múltiplas instâncias do backend
- Load balancer
- Banco de dados replicado

### Vertical

- Mais recursos (CPU, RAM)
- Otimização de queries
- Cache agressivo

## Próximos Passos

- Implementar sistema de notificações
- Adicionar WebSockets para tempo real
- Implementar filas para processamento assíncrono
- Adicionar monitoramento e métricas
