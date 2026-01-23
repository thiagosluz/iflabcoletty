# IFG Lab Manager

Sistema de gerenciamento de laboratórios de informática desenvolvido para o IFG (Instituto Federal de Goiás). Permite monitorar computadores, softwares instalados, hardware e gerar relatórios completos.

## 🚀 Características

- **Gerenciamento de Laboratórios**: Crie e gerencie múltiplos laboratórios
- **Monitoramento de Computadores**: Acompanhe status, hardware e softwares instalados
- **Agente de Coleta**: Agente Python que coleta dados automaticamente dos computadores
- **Relatórios**: Exporte relatórios em PDF, CSV e XLSX
- **QR Codes**: Gere QR codes para acesso rápido às informações dos computadores
- **Dashboard**: Visualize estatísticas e métricas do sistema
- **API RESTful**: API completa e documentada com Swagger/OpenAPI
- **Interface Moderna**: Frontend React com TypeScript e Tailwind CSS

## 🛠️ Tecnologias

### Backend
- Laravel 12
- PostgreSQL
- Redis
- Laravel Sanctum (Autenticação)
- RoadRunner (Octane)

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- Shadcn UI
- Zustand (Estado)
- React Router

### Agent
- Python 3
- psutil
- requests

## 📋 Pré-requisitos

- Docker e Docker Compose
- Git
- 4GB+ de RAM disponível

## 🚀 Instalação Rápida

1. **Clone o repositório**
```bash
git clone <repository-url>
cd iflabcoletty
```

2. **Configure o ambiente**
```bash
cd backend
cp .env.example .env  # Se existir
# Edite o .env com suas configurações
```

3. **Instale as dependências**
```bash
# Backend
docker compose exec app composer install

# Frontend
cd frontend
npm install
npm run build
```

4. **Configure o banco de dados**
```bash
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate
```

5. **Inicie os serviços**
```bash
docker compose up -d
```

6. **Acesse a aplicação**
- Frontend: http://localhost
- API: http://localhost:8000
- Documentação Swagger: http://localhost/api/documentation (após configurar)

## 📚 Documentação

Documentação completa disponível em `/docs`:

- [Guia de Instalação](docs/installation.md) - Instalação detalhada
- [Guia de Desenvolvimento](docs/development.md) - Como desenvolver
- [Documentação da API](docs/api.md) - Referência da API
- [Arquitetura](docs/architecture.md) - Arquitetura do sistema
- [Guia de Testes](docs/testing.md) - Como testar
- [Guia de Deploy](docs/deployment.md) - Deploy em produção

## 🧪 Testes

Execute os testes:

```bash
# Todos os testes
docker compose exec app php artisan test

# Testes unitários
docker compose exec app php artisan test --testsuite=Unit

# Testes de feature
docker compose exec app php artisan test --testsuite=Feature
```

## 📖 Uso

### Criar um Laboratório

1. Faça login no sistema
2. Acesse "Laboratórios"
3. Clique em "Novo Laboratório"
4. Preencha os dados e salve

### Registrar um Computador

1. Acesse "Computadores"
2. Clique em "Novo Computador"
3. Selecione o laboratório e informe o Machine ID
4. O computador será registrado

### Instalar o Agente

No computador que deseja monitorar:

```bash
cd agent
pip install -r requirements.txt
python main.py
```

O agente coletará dados automaticamente e enviará para o sistema.

### Gerar Relatórios

1. Acesse qualquer listagem (Laboratórios, Computadores, Softwares)
2. Clique em "Exportar"
3. Selecione o formato (PDF, CSV, XLSX)
4. O relatório será gerado e baixado

## 🔧 Configuração

### Variáveis de Ambiente Importantes

```env
APP_URL=http://localhost
FRONTEND_URL=http://localhost
DB_CONNECTION=pgsql
DB_HOST=db
DB_DATABASE=app
DB_USERNAME=user
DB_PASSWORD=password
```

### Configurar Swagger

Após instalar as dependências:

```bash
docker compose exec app php artisan l5-swagger:generate
```

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

Veja o [Guia de Desenvolvimento](docs/development.md) para mais detalhes.

## 📝 Estrutura do Projeto

```
iflabcoletty/
├── agent/              # Agente Python
├── backend/            # API Laravel
│   ├── app/
│   ├── database/
│   ├── routes/
│   └── tests/
├── frontend/           # Interface React
│   ├── src/
│   └── ...
├── docker/             # Configurações Docker
├── docs/               # Documentação
└── .github/            # GitHub Actions
```

## 🐛 Reportar Problemas

Se encontrar algum problema, abra uma issue no repositório com:
- Descrição do problema
- Passos para reproduzir
- Comportamento esperado vs. atual
- Screenshots (se aplicável)

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👥 Autores

- **Equipe IFG Lab Manager**

## 🙏 Agradecimentos

- Laravel Community
- React Community
- Todos os contribuidores

## 📞 Suporte

Para suporte, consulte:
- [Documentação](docs/)
- [Issues do Projeto](https://github.com/.../issues)
- [Documentação Swagger](http://localhost/api/documentation)

---

Desenvolvido com ❤️ para o IFG
