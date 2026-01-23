# Configuração do Swagger

Após adicionar o pacote `darkaonline/l5-swagger` ao `composer.json`, execute os seguintes comandos para configurar:

## 1. Instalar o pacote

```bash
docker compose exec app composer require darkaonline/l5-swagger
```

## 2. Publicar configuração

```bash
docker compose exec app php artisan vendor:publish --provider "L5Swagger\L5SwaggerServiceProvider"
```

## 3. Gerar documentação

```bash
docker compose exec app php artisan l5-swagger:generate
```

## 4. Acessar documentação

A documentação estará disponível em:
- `/api/documentation` (rota padrão)

## Notas

- As annotations Swagger já foram adicionadas nos controllers principais
- Você pode expandir as annotations conforme necessário
- Execute `l5-swagger:generate` sempre que modificar annotations
