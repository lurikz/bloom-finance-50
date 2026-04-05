import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Settings, Database, Users, CreditCard, BarChart3,
  Plus, Trash2, Pencil, Lock, Unlock, CheckCircle, XCircle,
  Loader2, RefreshCw, DollarSign, AlertTriangle, TrendingUp,
  Receipt, Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  is_blocked: boolean;
  created_at: string;
  client_type: 'recurring' | 'lifetime';
  plan_amount: number | null;
  due_day: number | null;
  latest_subscription: {
    id: string;
    amount: number;
    due_date: string;
    status: string;
    paid_at: string | null;
  } | null;
}

interface Subscription {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface AdminDashData {
  totalReceived: number;
  totalOverdue: number;
  totalPending: number;
  blockedLoss: number;
  totalUsers: number;
  blockedUsers: number;
  activeUsers: number;
  statusBreakdown: { status: string; count: number; total: number }[];
  monthlyRevenue: { month: string; total: number }[];
}

const STATUS_LABELS: Record<string, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencido' };
const STATUS_COLORS: Record<string, string> = { pending: 'hsl(40,90%,55%)', paid: 'hsl(160,84%,39%)', overdue: 'hsl(0,84%,60%)' };
const CLIENT_TYPE_LABELS: Record<string, string> = { recurring: 'Recorrente', lifetime: 'Vitalício' };

export default function Admin() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [dbStatus, setDbStatus] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userFilter, setUserFilter] = useState('all');
  const [userDialog, setUserDialog] = useState<'create' | 'edit' | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', client_type: 'recurring' as string, plan_amount: '', due_day: '' });

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subFilter, setSubFilter] = useState('all');
  const [subDialog, setSubDialog] = useState(false);
  const [subForm, setSubForm] = useState({ user_id: '', amount: '', due_date: '' });
  const [generating, setGenerating] = useState(false);

  const [dash, setDash] = useState<AdminDashData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  const loadDbStatus = async () => {
    setDbLoading(true); setDbError(null);
    try { setDbStatus(await api.getDbStatus()); } catch (e: any) { setDbError(e.message); } finally { setDbLoading(false); }
  };
  const loadUsers = async () => {
    setUsersLoading(true);
    try { setUsers(await api.getAdminUsers(userFilter === 'all' ? undefined : userFilter)); } catch { } finally { setUsersLoading(false); }
  };
  const loadSubs = async () => {
    setSubsLoading(true);
    try { setSubs(await api.getSubscriptions(subFilter === 'all' ? undefined : { status: subFilter })); } catch { } finally { setSubsLoading(false); }
  };
  const loadDash = async () => {
    setDashLoading(true);
    try { setDash(await api.getAdminDashboard()); } catch { } finally { setDashLoading(false); }
  };

  useEffect(() => { if (isAdmin) { loadDbStatus(); loadUsers(); loadSubs(); loadDash(); } }, [isAdmin]);
  useEffect(() => { if (isAdmin) loadUsers(); }, [userFilter, isAdmin]);
  useEffect(() => { if (isAdmin) loadSubs(); }, [subFilter, isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  // Handlers
  const handleInitDb = async () => {
    setInitializing(true);
    try { await api.initDb(); toast({ title: '✅ Schema atualizado!' }); await loadDbStatus(); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); } finally { setInitializing(false); }
  };
  const handleSyncCats = async () => {
    setSyncing(true);
    try { const r = await api.syncCategories(); toast({ title: '✅ ' + r.message }); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); } finally { setSyncing(false); }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = { name: userForm.name, email: userForm.email, client_type: userForm.client_type };
      if (userForm.password) data.password = userForm.password;
      if (userForm.client_type === 'recurring') {
        if (userForm.plan_amount) data.plan_amount = parseFloat(userForm.plan_amount);
        if (userForm.due_day) data.due_day = parseInt(userForm.due_day);
      }
      if (userDialog === 'create') {
        data.password = userForm.password;
        await api.createAdminUser(data);
        toast({ title: 'Usuário criado!' });
      } else if (editUser) {
        await api.updateAdminUser(editUser.id, data);
        toast({ title: 'Usuário atualizado!' });
      }
      setUserDialog(null); setEditUser(null); loadUsers();
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Excluir este usuário? Todos os dados serão perdidos.')) return;
    try { await api.deleteAdminUser(id); toast({ title: 'Usuário excluído' }); loadUsers(); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };
  const handleBlock = async (id: string, block: boolean) => {
    try { block ? await api.blockUser(id) : await api.unblockUser(id); toast({ title: block ? 'Usuário bloqueado' : 'Usuário desbloqueado' }); loadUsers(); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSubscription({ user_id: subForm.user_id, amount: parseFloat(subForm.amount), due_date: subForm.due_date });
      toast({ title: 'Cobrança criada!' }); setSubDialog(false); loadSubs(); loadDash();
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };
  const handlePaySub = async (id: string) => {
    try { await api.paySubscription(id); toast({ title: 'Pagamento registrado!' }); loadSubs(); loadDash(); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };
  const handleSetPending = async (id: string) => {
    try { await api.updateSubscriptionStatus(id, 'pending'); toast({ title: 'Status atualizado!' }); loadSubs(); loadDash(); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };
  const handleDeleteSub = async (id: string) => {
    if (!confirm('Excluir esta cobrança?')) return;
    try { await api.deleteSubscription(id); toast({ title: 'Cobrança excluída' }); loadSubs(); loadDash(); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };
  const handleGenerateSubs = async () => {
    setGenerating(true);
    try { const r = await api.generateSubscriptions(); toast({ title: '✅ ' + r.message }); loadSubs(); loadDash(); } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); } finally { setGenerating(false); }
  };

  const openCreateUser = () => { setUserForm({ name: '', email: '', password: '', client_type: 'recurring', plan_amount: '', due_day: '' }); setEditUser(null); setUserDialog('create'); };
  const openEditUser = (u: AdminUser) => { setUserForm({ name: u.name, email: u.email, password: '', client_type: u.client_type || 'recurring', plan_amount: u.plan_amount?.toString() || '', due_day: u.due_day?.toString() || '' }); setEditUser(u); setUserDialog('edit'); };
  const openCreateSub = () => { setSubForm({ user_id: '', amount: '', due_date: new Date().toISOString().split('T')[0] }); setSubDialog(true); };

  const requiredTables = ['users', 'categories', 'transactions', 'fixed_expenses', 'subscriptions'];
  const allTablesExist = dbStatus ? requiredTables.every((t: string) => dbStatus.tables?.includes(t)) : false;

  const pieData = dash?.statusBreakdown?.map(s => ({ name: STATUS_LABELS[s.status] || s.status, value: s.total, color: STATUS_COLORS[s.status] || '#999' })) || [];
  const revenueData = dash?.monthlyRevenue?.map(r => ({ month: new Date(r.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), total: r.total })).reverse() || [];

  // Filter subs for "due_soon" (next 5 days)
  const filteredSubs = subFilter === 'due_soon'
    ? subs.filter(s => {
        const due = new Date(s.due_date);
        const now = new Date();
        const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 5 && s.status === 'pending';
      })
    : subs;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Administração</h1>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-3.5 w-3.5" /> Usuários</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1"><Receipt className="h-3.5 w-3.5" /> Cobranças</TabsTrigger>
          <TabsTrigger value="system" className="gap-1"><Database className="h-3.5 w-3.5" /> Sistema</TabsTrigger>
        </TabsList>

        {/* ========== DASHBOARD ========== */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadDash} disabled={dashLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${dashLoading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
          {dashLoading && !dash ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : dash ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Recebido</CardTitle><DollarSign className="h-4 w-4 text-[hsl(var(--income))]" /></CardHeader><CardContent><p className="text-2xl font-bold text-[hsl(var(--income))]">{formatCurrency(dash.totalReceived)}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pendente</CardTitle><Clock className="h-4 w-4 text-amber-500" /></CardHeader><CardContent><p className="text-2xl font-bold text-amber-500">{formatCurrency(dash.totalPending)}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Em Atraso</CardTitle><AlertTriangle className="h-4 w-4 text-[hsl(var(--expense))]" /></CardHeader><CardContent><p className="text-2xl font-bold text-[hsl(var(--expense))]">{formatCurrency(dash.totalOverdue)}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Usuários</CardTitle><Users className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold text-foreground">{dash.totalUsers}</p><p className="text-xs text-muted-foreground mt-1">{dash.activeUsers} ativos · {dash.blockedUsers} bloqueados</p></CardContent></Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card><CardHeader><CardTitle className="text-base">Receita Mensal</CardTitle></CardHeader><CardContent><div className="h-[250px]">{revenueData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><BarChart data={revenueData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" className="text-xs fill-muted-foreground" /><YAxis className="text-xs fill-muted-foreground" /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Bar dataKey="total" name="Recebido" fill="hsl(160,84%,39%)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>) : <p className="text-center text-sm text-muted-foreground py-10">Sem dados</p>}</div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">Status das Cobranças</CardTitle></CardHeader><CardContent><div className="h-[250px]">{pieData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{pieData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v)} /></PieChart></ResponsiveContainer>) : <p className="text-center text-sm text-muted-foreground py-10">Sem dados</p>}</div></CardContent></Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ========== USERS ========== */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
                <SelectItem value="overdue">Mensalidade vencida</SelectItem>
                <SelectItem value="due_soon">Próx. do vencimento</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gap-2" onClick={openCreateUser}><Plus className="h-4 w-4" /> Novo Usuário</Button>
          </div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Plano</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário</TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.client_type === 'lifetime' ? 'secondary' : 'outline'}>
                        {CLIENT_TYPE_LABELS[u.client_type] || 'Recorrente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.is_blocked ? <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Bloqueado</Badge> : <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Ativo</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.client_type === 'recurring' && u.plan_amount ? (
                        <span className="text-muted-foreground">{formatCurrency(u.plan_amount)} · dia {u.due_day}</span>
                      ) : u.client_type === 'lifetime' ? (
                        <span className="text-muted-foreground">Vitalício</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditUser(u)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleBlock(u.id, !u.is_blocked)}>
                          {u.is_blocked ? <Unlock className="h-4 w-4 text-[hsl(var(--income))]" /> : <Lock className="h-4 w-4 text-amber-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteUser(u.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div></CardContent></Card>

          {/* User dialog */}
          <Dialog open={!!userDialog} onOpenChange={(o) => !o && setUserDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{userDialog === 'create' ? 'Novo Usuário' : 'Editar Usuário'}</DialogTitle>
                <DialogDescription>{userDialog === 'create' ? 'Crie uma nova conta.' : 'Atualize os dados do usuário.'}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required={userDialog === 'create'} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required={userDialog === 'create'} /></div>
                <div className="space-y-2"><Label>Senha {userDialog === 'edit' && <span className="text-xs text-muted-foreground">(deixe vazio para manter)</span>}</Label><Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required={userDialog === 'create'} minLength={6} /></div>

                <div className="space-y-3">
                  <Label>Tipo de cliente</Label>
                  <RadioGroup value={userForm.client_type} onValueChange={(v) => setUserForm({ ...userForm, client_type: v })} className="flex gap-4">
                    <div className="flex items-center gap-2"><RadioGroupItem value="recurring" id="recurring" /><Label htmlFor="recurring" className="cursor-pointer">Recorrente</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="lifetime" id="lifetime" /><Label htmlFor="lifetime" className="cursor-pointer">Vitalício</Label></div>
                  </RadioGroup>
                </div>

                {userForm.client_type === 'recurring' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Valor do plano (R$)</Label><Input type="number" step="0.01" min="0.01" value={userForm.plan_amount} onChange={(e) => setUserForm({ ...userForm, plan_amount: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Dia de vencimento</Label><Input type="number" min="1" max="31" value={userForm.due_day} onChange={(e) => setUserForm({ ...userForm, due_day: e.target.value })} required /></div>
                  </div>
                )}

                <Button type="submit" className="w-full">{userDialog === 'create' ? 'Criar' : 'Salvar'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ========== COBRANÇAS ========== */}
        <TabsContent value="billing" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Select value={subFilter} onValueChange={(v) => { setSubFilter(v); if (v !== 'due_soon') loadSubs(); }}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="due_soon">Próx. do vencimento (5 dias)</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={handleGenerateSubs} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Gerar Cobranças
              </Button>
              <Button className="gap-2" onClick={openCreateSub}><Plus className="h-4 w-4" /> Nova Cobrança</Button>
            </div>
          </div>

          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Usuário</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead>Pago em</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {subsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filteredSubs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma cobrança</TableCell></TableRow>
                ) : filteredSubs.map(s => (
                  <TableRow key={s.id}>
                    <TableCell><div><p className="font-medium text-sm">{s.user_name}</p><p className="text-xs text-muted-foreground">{s.user_email}</p></div></TableCell>
                    <TableCell className="font-semibold">{formatCurrency(s.amount)}</TableCell>
                    <TableCell className="text-sm">{new Date(s.due_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'paid' ? 'default' : s.status === 'overdue' ? 'destructive' : 'secondary'}>
                        {STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.paid_at ? new Date(s.paid_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {s.status !== 'paid' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--income))]" onClick={() => handlePaySub(s.id)} title="Marcar como pago">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {s.status === 'paid' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500" onClick={() => handleSetPending(s.id)} title="Marcar como pendente">
                            <Clock className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSub(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div></CardContent></Card>

          {/* Subscription dialog */}
          <Dialog open={subDialog} onOpenChange={setSubDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Cobrança</DialogTitle>
                <DialogDescription>Crie uma cobrança para um usuário.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select value={subForm.user_id} onValueChange={(v) => setSubForm({ ...subForm, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0.01" value={subForm.amount} onChange={(e) => setSubForm({ ...subForm, amount: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={subForm.due_date} onChange={(e) => setSubForm({ ...subForm, due_date: e.target.value })} required /></div>
                </div>
                <Button type="submit" className="w-full">Criar Cobrança</Button>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>


        {/* ========== SYSTEM ========== */}
        <TabsContent value="system" className="space-y-6">
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Status do Backend</CardTitle></CardHeader>
            <CardContent>
              {dbLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</div>
              ) : dbError ? (
                <div className="space-y-2"><div className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Backend indisponível</div><p className="text-sm text-muted-foreground">{dbError}</p></div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">{allTablesExist ? (<><CheckCircle className="h-5 w-5 text-primary" /><span className="font-medium text-primary">Backend configurado</span></>) : (<><XCircle className="h-5 w-5 text-amber-500" /><span className="font-medium text-amber-500">Schema incompleto</span></>)}</div>
                  <div className="flex flex-wrap gap-2">{requiredTables.map(t => { const exists = dbStatus?.tables?.includes(t); return (<Badge key={t} variant={exists ? 'default' : 'destructive'} className="gap-1">{exists ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} {t}{exists && dbStatus?.counts[t] !== undefined && <span className="ml-1 opacity-70">({dbStatus.counts[t]})</span>}</Badge>); })}</div>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Schema</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Cria ou atualiza tabelas e colunas.</p><Button className="gap-2 w-full" onClick={handleInitDb} disabled={initializing || dbLoading || !!dbError}>{initializing ? <><Loader2 className="h-4 w-4 animate-spin" /> Implementando...</> : <><Database className="h-4 w-4" /> Implementar Schema</>}</Button></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Categorias</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Insere categorias padrão para todos os usuários.</p><Button variant="outline" className="gap-2 w-full" onClick={handleSyncCats} disabled={syncing || dbLoading || !!dbError}>{syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Sincronizando...</> : <><Users className="h-4 w-4" /> Sincronizar Categorias</>}</Button></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
