import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Transaction { id: string; description: string; amount: number; type: 'income' | 'expense'; category_id: string; category_name: string; date: string; }
interface Category { id: string; name: string; type: string; }
interface Saving { id: string; name: string; current_amount: number; target_amount: number | null; }

export default function Transactions() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({ description: '', amount: '', type: 'expense' as 'income' | 'expense', category_id: '', date: new Date().toISOString().split('T')[0] });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMonths, setRecurrenceMonths] = useState('12');
  const [addToSaving, setAddToSaving] = useState(false);
  const [selectedSavingId, setSelectedSavingId] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getTransactions({ month, year }), api.getCategories(), api.getSavings().catch(() => [])])
      .then(([t, c, s]) => { setTransactions(t); setCategories(c); setSavings(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month, year]);

  const filteredCats = categories.filter(c => c.type === form.type);

  const openCreate = () => {
    setEditing(null);
    setForm({ description: '', amount: '', type: 'expense', category_id: '', date: new Date().toISOString().split('T')[0] });
    setIsRecurring(false);
    setRecurrenceMonths('12');
    setAddToSaving(false);
    setSelectedSavingId('');
    setDialogOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({ description: t.description, amount: String(t.amount), type: t.type, category_id: t.category_id, date: t.date.split('T')[0] });
    setIsRecurring(false);
    setRecurrenceMonths('12');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount || !form.category_id || !form.date) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    try {
      if (editing) {
        await api.updateTransaction(editing.id, { ...form, amount, description: form.description.trim() });
        toast({ title: 'Transação atualizada!' });
      } else if (isRecurring && form.type === 'expense') {
        const months = parseInt(recurrenceMonths);
        if (isNaN(months) || months < 1) {
          toast({ title: 'Meses de recorrência inválido', variant: 'destructive' });
          return;
        }
        await api.createFixedExpense({
          description: form.description.trim(),
          amount,
          category_id: form.category_id,
          start_date: form.date,
          recurrence_months: months,
        });
        toast({ title: 'Gasto fixo e transações recorrentes criados!' });
      } else {
        await api.createTransaction({ ...form, amount, description: form.description.trim() });
        // If adding to a saving, deposit the amount
        if (addToSaving && selectedSavingId && form.type === 'expense') {
          await api.depositSaving(selectedSavingId, { amount, description: `Depósito via transação: ${form.description.trim()}` });
        }
        toast({ title: 'Transação criada!' });
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta transação?')) return;
    try {
      await api.deleteTransaction(id);
      toast({ title: 'Transação excluída' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Transações</h1>
        <div className="flex gap-2 flex-wrap">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Nova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Editar transação' : 'Nova transação'}</DialogTitle><DialogDescription>{editing ? 'Atualize os dados da transação.' : 'Cadastre uma nova entrada ou saída.'}</DialogDescription></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input maxLength={100} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v: 'income' | 'expense') => setForm({ ...form, type: v, category_id: '' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Entrada</SelectItem>
                        <SelectItem value="expense">Saída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!editing && form.type === 'expense' && (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="recurring"
                        checked={isRecurring}
                        onChange={(e) => { setIsRecurring(e.target.checked); if (e.target.checked) setAddToSaving(false); }}
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="recurring" className="cursor-pointer text-sm">Esta transação é recorrente?</Label>
                    </div>
                    {isRecurring && (
                      <div className="space-y-2">
                        <Label>Por quantos meses?</Label>
                        <Input type="number" min="1" max="120" value={recurrenceMonths} onChange={(e) => setRecurrenceMonths(e.target.value)} />
                      </div>
                    )}
                  </div>
                )}
                {!editing && form.type === 'expense' && !isRecurring && savings.length > 0 && (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="addToSaving"
                        checked={addToSaving}
                        onChange={(e) => { setAddToSaving(e.target.checked); if (!e.target.checked) setSelectedSavingId(''); }}
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="addToSaving" className="cursor-pointer text-sm">Adicionar a uma economia?</Label>
                    </div>
                    {addToSaving && (
                      <div className="space-y-2">
                        <Label>Economia</Label>
                        <Select value={selectedSavingId} onValueChange={setSelectedSavingId}>
                          <SelectTrigger><SelectValue placeholder="Selecione a economia" /></SelectTrigger>
                          <SelectContent>
                            {savings.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} ({formatCurrency(s.current_amount)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                <Button type="submit" className="w-full">{editing ? 'Salvar' : 'Criar'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma transação</TableCell></TableRow>
                ) : (
                  transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{new Date(t.date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.category_name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${t.type === 'income' ? 'bg-accent text-accent-foreground' : 'bg-destructive/10 text-destructive'}`}>
                          {t.type === 'income' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {t.type === 'income' ? 'Entrada' : 'Saída'}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${t.type === 'income' ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
