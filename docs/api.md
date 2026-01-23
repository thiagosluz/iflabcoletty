# Documentação da API

A API do IFG Lab Manager fornece endpoints RESTful para gerenciar laboratórios, computadores e softwares.

## Base URL

```
http://localhost:8000/api/v1
```

## Autenticação

A API usa Laravel Sanctum para autenticação via Bearer Token.

### Login

```http
POST /api/v1/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password"
}
```

**Resposta:**

```json
{
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@example.com"
  },
  "token": "1|xxxxxxxxxxxx"
}
```

### Usar o Token

Inclua o token no header de todas as requisições autenticadas:

```http
Authorization: Bearer 1|xxxxxxxxxxxx
```

## Endpoints Principais

### Autenticação

- `POST /api/v1/login` - Fazer login
- `POST /api/v1/logout` - Fazer logout (requer autenticação)
- `GET /api/v1/me` - Obter informações do usuário (requer autenticação)

### Laboratórios

- `GET /api/v1/labs` - Listar laboratórios
- `POST /api/v1/labs` - Criar laboratório
- `GET /api/v1/labs/{id}` - Obter detalhes do laboratório
- `PUT /api/v1/labs/{id}` - Atualizar laboratório
- `DELETE /api/v1/labs/{id}` - Excluir laboratório
- `GET /api/v1/labs/{id}/computers` - Listar computadores do laboratório
- `GET /api/v1/labs/{id}/softwares` - Listar softwares do laboratório

### Computadores

- `GET /api/v1/computers` - Listar computadores
- `POST /api/v1/computers` - Criar computador
- `GET /api/v1/computers/{id}` - Obter detalhes do computador
- `PUT /api/v1/computers/{id}` - Atualizar computador
- `DELETE /api/v1/computers/{id}` - Excluir computador
- `POST /api/v1/computers/{id}/report` - Receber relatório do agente
- `GET /api/v1/computers/{id}/qrcode` - Gerar QR code do computador
- `POST /api/v1/computers/export-qrcodes` - Exportar QR codes
- `GET /api/v1/computers/{id}/softwares` - Listar softwares do computador

### Softwares

- `GET /api/v1/softwares` - Listar softwares
- `GET /api/v1/softwares/{id}` - Obter detalhes do software

### Dashboard

- `GET /api/v1/dashboard/stats` - Obter estatísticas do dashboard

### Relatórios

- `POST /api/v1/reports/labs` - Exportar relatório de laboratórios (PDF/CSV/XLSX)
- `POST /api/v1/reports/computers` - Exportar relatório de computadores (PDF/CSV/XLSX)
- `POST /api/v1/reports/softwares` - Exportar relatório de softwares (PDF/CSV/XLSX)

### Público (sem autenticação)

- `GET /api/v1/public/computers/{hash}` - Visualizar computador por hash público
- `GET /api/v1/public/computers/{hash}/softwares` - Listar softwares do computador público

## Paginação

A maioria dos endpoints de listagem suporta paginação:

```
GET /api/v1/computers?page=1&per_page=20
```

**Resposta:**

```json
{
  "data": [...],
  "current_page": 1,
  "per_page": 20,
  "total": 100,
  "last_page": 5
}
```

## Filtros e Busca

Muitos endpoints suportam filtros:

```
GET /api/v1/computers?search=teste&lab_id=1&status=online
```

## Códigos de Status HTTP

- `200` - Sucesso
- `201` - Criado com sucesso
- `204` - Sem conteúdo (sucesso em DELETE)
- `401` - Não autenticado
- `403` - Não autorizado
- `404` - Não encontrado
- `422` - Erro de validação
- `500` - Erro interno do servidor

## Documentação Interativa

A documentação completa e interativa está disponível via Swagger/OpenAPI:

```
http://localhost/api/documentation
```

Você pode testar os endpoints diretamente na interface Swagger.

## Exemplos de Uso

### Criar um Laboratório

```bash
curl -X POST http://localhost:8000/api/v1/labs \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laboratório de Informática",
    "description": "Laboratório principal"
  }'
```

### Listar Computadores com Filtros

```bash
curl -X GET "http://localhost:8000/api/v1/computers?lab_id=1&status=online&per_page=10" \
  -H "Authorization: Bearer TOKEN"
```

### Exportar Relatório

```bash
curl -X POST http://localhost:8000/api/v1/reports/computers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "pdf",
    "lab_id": 1,
    "search": "teste"
  }' \
  --output relatorio.pdf
```

## Rate Limiting

Atualmente não há rate limiting implementado, mas é recomendado para produção.

## Suporte

Para questões sobre a API, consulte:
- A documentação Swagger interativa
- O [Guia de Desenvolvimento](development.md)
- Issues no repositório do projeto
