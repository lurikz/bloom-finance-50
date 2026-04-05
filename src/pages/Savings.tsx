import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, PiggyBank, Loader2, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Saving {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number | null;
  created_at: string;
}

interface Movement {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  description: string;
  created_at: string;
}

export default function Savings() {
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ type: 'deposit' | 'withdraw'; saving: Saving } | null>(null);
  const [detailDialog, setDetailDialog] = useState<Saving | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', target_amount: '' });
  const [actionForm, setActionForm] = useState({ amount: '', description: '' });
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    api.getSavings().then(setSavings).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalSaved = savings.reduce((a, s) => a + s.current_amount, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    try {
      await api.createSaving({
        name: createForm.name.trim(),
        target_amount: createForm.target_amount ? parseFloat(createForm.target_amount) : undefined,
      });
      toast({ title: 'Economia criada!' });
      setCreateDialog(false);
      setCreateForm({ name: '', target_amount: '' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDialog) return;
    const amount = parseFloat(actionForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    try {
      if (actionDialog.type === 'deposit') {
        await api.depositSaving(actionDialog.saving.id, { amount, description: actionForm.description.trim() || undefined });
        toast({ title: `${formatCurrency(amount)} adicionado!` });
      } else {
        await api.withdrawSaving(actionDialog.saving.id, { amount, description: actionForm.description.trim() || undefined });
        toast({ title: `${formatCurrency(amount)} retirado!` });
      }
      setActionDialog(null);
      setActionForm({ amount: '', description: '' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta economia? Todo o histórico será perdido.')) return;
    try {
      await api.deleteSaving(id);
      toast({ title: 'Economia excluída' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const openDetail = async (saving: Saving) => {
    setDetailDialog(saving);
    setMovementsLoading(true);
    try {
      const m = await api.getSavingMovements(saving.id);
      setMovements(m);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Economias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total guardado: <span className="font-semibold text-[hsl(var(--income))]">{formatCurrency(totalSaved)}</span>
          </p>
        </div>
        <Button className="gap-2" onClick={() => { setCreateForm({ name: '', target_amount: '' }); setCreateDialog(true); }}>
          <Plus className="h-4 w-4" /> Criar Economia
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : savings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <PiggyBank className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma economia criada ainda</p>
            <Button variant="outline" className="gap-2" onClick={() => setCreateDialog(true)}>
              <Plus className="h-4 w-4" /> Criar sua primeira economia
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savings.map((s) => {
            const progress = s.target_amount ? Math.min((s.current_amount / s.target_amount) * 100, 100) : null;
            return (
              <Card key={s.id} className="group relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => openDetail(s)}>
                      <PiggyBank className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base hover:underline">{s.name}</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold text-[hsl(var(--income))]">{formatCurrency(s.current_amount)}</p>
                    {s.target_amount && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Meta: {formatCurrency(s.target_amount)}
                      </p>
                    )}
                  </div>
                  {progress !== null && (
                    <div className="space-y-1">
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">{progress.toFixed(0)}%</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => { setActionForm({ amount: '', description: '' }); setActionDialog({ type: 'deposit', saving: s }); }}>
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Depositar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => { setActionForm({ amount: '', description: '' }); setActionDialog({ type: 'withdraw', saving: s }); }} disabled={s.current_amount <= 0}>
                      <ArrowUpFromLine className="h-3.5 w-3.5" /> Retirar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Economia</DialogTitle>
            <DialogDescription>Defina um nome e opcionalmente um valor objetivo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input maxLength={100} placeholder="Ex: Comprar celular" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Valor objetivo (opcional)</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="Ex: 5000.00" value={createForm.target_amount} onChange={(e) => setCreateForm({ ...createForm, target_amount: e.target.value })} />
            </div>
            <Button type="submit" className="w-full">Criar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deposit/Withdraw Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog?.type === 'deposit' ? 'Depositar' : 'Retirar'} - {actionDialog?.saving.name}</DialogTitle>
            <DialogDescription>
              Saldo atual: {actionDialog ? formatCurrency(actionDialog.saving.current_amount) : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAction} className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={actionDialog?.type === 'withdraw' ? actionDialog.saving.current_amount : undefined}
                value={actionForm.amount}
                onChange={(e) => setActionForm({ ...actionForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input maxLength={100} placeholder="Ex: Salário do mês" value={actionForm.description} onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })} />
            </div>
            <Button type="submit" className="w-full">
              {actionDialog?.type === 'deposit' ? 'Depositar' : 'Retirar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail/Movements Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={(o) => !o && setDetailDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-primary" /> {detailDialog?.name}
            </DialogTitle>
            <DialogDescription>
              Saldo: {detailDialog ? formatCurrency(detailDialog.current_amount) : ''}
              {detailDialog?.target_amount ? ` / Meta: ${formatCurrency(detailDialog.target_amount)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            <p className="text-sm font-medium text-foreground">Movimentações</p>
            {movementsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação</p>
            ) : (
              movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    {m.type === 'deposit' ? (
                      <TrendingUp className="h-4 w-4 text-[hsl(var(--income))]" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-[hsl(var(--expense))]" />
                    )}
                    <div>
                      <p className="text-sm">{m.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${m.type === 'deposit' ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]'}`}>
                    {m.type === 'deposit' ? '+' : '-'}{formatCurrency(m.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
