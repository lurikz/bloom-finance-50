# FinControl Backend

## Configuração no EasyPanel

### 1. Criar o banco PostgreSQL
No EasyPanel, adicione um serviço PostgreSQL e anote as credenciais.

### 2. Variáveis de ambiente
Configure estas variáveis no serviço do backend:

```
DATABASE_URL=postgresql://usuario:senha@host:5432/fincontrol
JWT_SECRET=sua-chave-secreta-muito-longa-e-aleatoria-min-32-chars
PORT=3001
FRONTEND_URL=https://seu-frontend.com
ADMIN_EMAIL=padilha.ctt@gmail.com
```

### 3. Deploy
1. Crie um serviço "App" no EasyPanel
2. Aponte para este diretório `/backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Expor a porta 3001

### 4. Inicializar o banco
O backend executa a inicialização automaticamente no `prestart`.

### 5. Frontend
No frontend, configure a variável:
```
VITE_API_URL=https://seu-backend.com/api
```

## Rotas Admin (restritas a ADMIN_EMAIL)
- `GET /api/admin/db-status` — status do banco
- `POST /api/admin/init-db` — criar/atualizar schema
- `POST /api/admin/sync-categories` — sincronizar categorias padrão
- `GET /api/admin/users?status=` — listar usuários (all/active/blocked/overdue/due_soon)
- `POST /api/admin/users` — criar usuário
- `PUT /api/admin/users/:id` — editar usuário
- `DELETE /api/admin/users/:id` — excluir usuário
- `POST /api/admin/users/:id/block` — bloquear
- `POST /api/admin/users/:id/unblock` — desbloquear
- `GET /api/admin/subscriptions?user_id=&status=` — listar mensalidades
- `POST /api/admin/subscriptions` — criar mensalidade
- `POST /api/admin/subscriptions/:id/pay` — registrar pagamento
- `DELETE /api/admin/subscriptions/:id` — excluir mensalidade
- `GET /api/admin/dashboard` — indicadores administrativos

## Segurança implementada
- ✅ Senhas com bcrypt (12 rounds)
- ✅ JWT com expiração de 7 dias
- ✅ Rate limiting nas rotas de auth
- ✅ Helmet para headers de segurança
- ✅ CORS restrito ao frontend
- ✅ Validação de input com express-validator
- ✅ Queries parametrizadas (anti SQL injection)
- ✅ Filtragem por user_id em todas as queries
- ✅ Admin restrito por email no middleware (requireAdmin)
- ✅ Bloqueio de usuários impede login
- ✅ Atualização automática de mensalidades vencidas
