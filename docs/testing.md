# Guia de Testes

Este guia explica como executar e escrever testes para o projeto.

## Executando Testes

### Todos os Testes

```bash
docker compose exec app php artisan test
```

### Testes Específicos

```bash
# Testes unitários
docker compose exec app php artisan test --testsuite=Unit

# Testes de feature
docker compose exec app php artisan test --testsuite=Feature

# Teste específico
docker compose exec app php artisan test tests/Feature/AuthTest.php

# Método específico
docker compose exec app php artisan test --filter test_user_can_login
```

## Estrutura de Testes

```
tests/
├── TestCase.php          # Classe base para testes
├── Unit/                 # Testes unitários
│   ├── ComputerTest.php
│   ├── LabTest.php
│   └── ...
└── Feature/              # Testes de integração/feature
    ├── AuthTest.php
    ├── LabTest.php
    └── ...
```

## Tipos de Testes

### Testes Unitários

Testam componentes isolados (models, helpers, etc).

**Exemplo:**

```php
public function test_computer_belongs_to_lab(): void
{
    $lab = Lab::factory()->create();
    $computer = Computer::factory()->create(['lab_id' => $lab->id]);

    $this->assertInstanceOf(Lab::class, $computer->lab);
    $this->assertEquals($lab->id, $computer->lab->id);
}
```

### Testes de Feature

Testam endpoints da API e fluxos completos.

**Exemplo:**

```php
public function test_authenticated_user_can_list_labs(): void
{
    $user = $this->actingAsUser();
    Lab::factory()->count(3)->create();

    $response = $this->getJson('/api/v1/labs', $this->getAuthHeaders($user));

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'description'],
            ],
        ]);
}
```

## Helpers de Teste

### TestCase Base

A classe `TestCase` fornece helpers úteis:

```php
// Criar e autenticar usuário
$user = $this->actingAsUser();

// Obter headers de autenticação
$headers = $this->getAuthHeaders($user);
```

### Factories

Use factories para criar dados de teste:

```php
$lab = Lab::factory()->create();
$computer = Computer::factory()->withHardwareInfo()->create();
```

## Asserções Comuns

### Respostas HTTP

```php
$response->assertStatus(200);
$response->assertStatus(201);
$response->assertStatus(404);
```

### JSON

```php
$response->assertJson(['key' => 'value']);
$response->assertJsonStructure(['data', 'meta']);
$response->assertJsonPath('data.0.name', 'Expected Name');
```

### Banco de Dados

```php
$this->assertDatabaseHas('labs', ['name' => 'Lab Name']);
$this->assertDatabaseMissing('labs', ['id' => 999]);
```

### Validação

```php
$response->assertJsonValidationErrors(['email']);
$response->assertValid(['name']);
```

## Boas Práticas

### 1. Nomes Descritivos

```php
// Bom
test_authenticated_user_can_create_lab()

// Ruim
test_lab()
```

### 2. Um Teste, Uma Coisa

Cada teste deve verificar uma funcionalidade específica.

### 3. Arrange-Act-Assert

```php
// Arrange - Preparar dados
$user = $this->actingAsUser();
$lab = Lab::factory()->create();

// Act - Executar ação
$response = $this->getJson("/api/v1/labs/{$lab->id}", $this->getAuthHeaders($user));

// Assert - Verificar resultado
$response->assertStatus(200);
```

### 4. Usar Factories

Não crie dados manualmente:

```php
// Bom
$lab = Lab::factory()->create();

// Ruim
$lab = new Lab();
$lab->name = 'Test';
$lab->save();
```

### 5. Isolar Testes

Cada teste deve ser independente. Use `RefreshDatabase`:

```php
use Illuminate\Foundation\Testing\RefreshDatabase;

class LabTest extends TestCase
{
    use RefreshDatabase;
    // ...
}
```

## Cobertura de Testes

### Endpoints Críticos

- Autenticação
- CRUD de entidades principais
- Relatórios e exportações
- Endpoints públicos

### Casos de Teste

Para cada endpoint, teste:

1. **Sucesso**: Requisição válida retorna 200/201
2. **Validação**: Dados inválidos retornam 422
3. **Autenticação**: Requisições não autenticadas retornam 401
4. **Autorização**: (quando implementado) usuários sem permissão retornam 403
5. **Não encontrado**: IDs inválidos retornam 404

## Testes de Integração

Testes que verificam fluxos completos:

```php
public function test_complete_computer_registration_flow(): void
{
    // 1. Criar laboratório
    $lab = Lab::factory()->create();
    
    // 2. Criar computador
    $computer = Computer::factory()->create(['lab_id' => $lab->id]);
    
    // 3. Enviar relatório do agente
    $response = $this->postJson("/api/v1/computers/{$computer->id}/report", [
        'hardware_info' => [...],
        'softwares' => [...],
    ]);
    
    // 4. Verificar que tudo foi salvo
    $this->assertDatabaseHas('computer_activities', [
        'computer_id' => $computer->id,
    ]);
}
```

## Debugging de Testes

### Ver Resposta Completa

```php
$response->dump();
```

### Ver Dados do Banco

```php
$this->assertDatabaseHas('labs', ['name' => 'Test']);
// Se falhar, use:
dd(\DB::table('labs')->get());
```

### Logs

Os testes usam o mesmo sistema de logs. Verifique `storage/logs/laravel.log`.

## CI/CD

Os testes são executados automaticamente no GitHub Actions em cada push/PR.

Veja `.github/workflows/tests.yml` para configuração.

## Recursos

- [Documentação PHPUnit](https://phpunit.de/documentation.html)
- [Laravel Testing](https://laravel.com/docs/testing)
- [Test-Driven Development](https://en.wikipedia.org/wiki/Test-driven_development)
