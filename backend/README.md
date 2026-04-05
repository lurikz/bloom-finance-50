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
```

### 3. Deploy
1. Crie um serviço "App" no EasyPanel
2. Aponte para este diretório `/backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Expor a porta 3001

### 4. Inicializar o banco
Após o deploy, rode uma vez:
```bash
npm run db:init
```

### 5. Frontend
No frontend, configure a variável:
```
VITE_API_URL=https://seu-backend.com/api
```

## Segurança implementada
- ✅ Senhas com bcrypt (12 rounds)
- ✅ JWT com expiração de 7 dias
- ✅ Rate limiting nas rotas de auth
- ✅ Helmet para headers de segurança
- ✅ CORS restrito ao frontend
- ✅ Validação de input com express-validator
- ✅ Queries parametrizadas (anti SQL injection)
- ✅ Filtragem por user_id em todas as queries
