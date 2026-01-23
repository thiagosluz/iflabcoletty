# Guia de Desenvolvimento

Este guia fornece informações sobre como desenvolver e contribuir para o projeto.

## Estrutura do Projeto

```
iflabcoletty/
├── agent/              # Agente Python para coleta de dados
├── backend/            # API Laravel
│   ├── app/
│   │   ├── Http/Controllers/
│   │   ├── Models/
│   │   └── ...
│   ├── database/
│   ├── routes/
│   └── tests/
├── frontend/           # Interface React
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── ...
│   └── ...
├── docker/             # Configurações Docker
└── docs/               # Documentação
```

## Ambiente de Desenvolvimento

### Backend (Laravel)

O backend roda em um container Docker. Para desenvolvimento:

```bash
# Acessar o container
docker compose exec app bash

# Executar comandos Artisan
docker compose exec app php artisan <comando>

# Ver logs
docker compose exec app php artisan pail
```

### Frontend (React)

O frontend pode rodar em modo desenvolvimento:

```bash
cd frontend
npm run dev
```

Ou usar o serviço node do docker-compose que já está configurado.

## Comandos Úteis

### Backend

```bash
# Executar testes
docker compose exec app php artisan test

# Executar migrações
docker compose exec app php artisan migrate

# Criar migration
docker compose exec app php artisan make:migration nome_da_migration

# Limpar cache
docker compose exec app php artisan cache:clear
docker compose exec app php artisan config:clear
docker compose exec app php artisan route:clear

# Gerar documentação Swagger
docker compose exec app php artisan l5-swagger:generate
```

### Frontend

```bash
# Instalar dependências
npm install

# Modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Linting
npm run lint
```

## Padrões de Código

### PHP (Laravel)

- Use Laravel Pint para formatação: `docker compose exec app vendor/bin/pint`
- Siga PSR-12 para estilo de código
- Use type hints sempre que possível
- Documente métodos públicos com PHPDoc

### TypeScript/React

- Use TypeScript strict mode
- Siga as regras do ESLint configuradas
- Use componentes funcionais com hooks
- Prefira named exports

## Estrutura de Commits

Use mensagens de commit descritivas:

```
feat: adiciona funcionalidade de exportação de relatórios
fix: corrige erro na paginação de computadores
docs: atualiza documentação da API
test: adiciona testes para LabController
```

## Workflow de Desenvolvimento

1. Crie uma branch a partir de `main` ou `develop`
2. Desenvolva a funcionalidade
3. Escreva testes para novas funcionalidades
4. Execute os testes: `docker compose exec app php artisan test`
5. Verifique o linting: `docker compose exec app vendor/bin/pint --test`
6. Faça commit e push
7. Abra um Pull Request

## Testes

Veja o [Guia de Testes](testing.md) para informações detalhadas sobre como escrever e executar testes.

## API Development

- Todos os endpoints devem ter annotations Swagger
- Use Form Requests para validação quando apropriado
- Retorne sempre JSON com status codes apropriados
- Documente exemplos de request/response

## Banco de Dados

- Use migrations para todas as mudanças no schema
- Sempre crie factories para novos models
- Use seeders para dados iniciais quando necessário

## Debugging

### Backend

```bash
# Ver logs do Laravel
docker compose exec app tail -f storage/logs/laravel.log

# Usar Tinker para debug
docker compose exec app php artisan tinker
```

### Frontend

- Use React DevTools
- Verifique o console do navegador
- Use breakpoints no código

## Recursos Adicionais

- [Documentação Laravel](https://laravel.com/docs)
- [Documentação React](https://react.dev)
- [Documentação TypeScript](https://www.typescriptlang.org/docs)
