# FinControl Frontend

## Categorias com cores
- Seletor de cor em gradiente abre em popover dedicado.
- Clique ou arraste no gradiente para atualizar a cor em tempo real.
- O seletor fecha apenas ao clicar fora do componente.

## Aba Admin
- **Acesso restrito**: somente `padilha.ctt@gmail.com` pode acessar.
- **Verificação dupla**: frontend oculta a aba para não-admins e backend verifica o email em todas as rotas `/api/admin/*`.
- **Gestão de Usuários**: criar, editar, excluir e bloquear/desbloquear usuários.
- **Mensalidades**: criar vencimentos, registrar pagamentos, excluir. Status automático (pending/paid/overdue).
- **Dashboard Administrativo**: total recebido, em atraso, perdido (bloqueados), gráficos de receita mensal e status das mensalidades.
- **Sistema**: implementar schema e sincronizar categorias padrão.

## Tabelas do banco
- `users` — com coluna `is_blocked`
- `categories` — com coluna `color`
- `transactions`
- `fixed_expenses`
- `subscriptions` — user_id, amount, due_date, status (pending/paid/overdue), paid_at
