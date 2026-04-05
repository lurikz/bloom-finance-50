import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil, Repeat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface FixedExpense {
  id: string;
  description: string;
  amount: number;
  category_id: string;
  category_name: string;
  start_date: string;
  recurrence_months: number;
}
interface Category { id: string; name: string; type: string; }

export default function FixedExpenses() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    start_date: new Date().toISOString().split('T')[0],
    recurrence_months: '12',
  });

  const load = () => {
    setLoading(true);
    Promise.all([api.getFixedExpenses(), api.getCategories()])
      .then(([fe, c]) => { setItems(fe); setCategories(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const expenseCats = categories.filter(c => c.type === 'expense');

  const openCreate = () => {
    setEditing(null);
    setForm({ description: '', amount: '', category_id: '', start_date: new Date().toISOString().split('T')[0], recurrence_months: '12' });
    setDialogOpen(true);
  };

  const openEdit = (fe: FixedExpense) => {
    setEditing(fe);
    setForm({
      description: fe.description,
      amount: String(fe.amount),
      category_id: fe.category_id,
      start_date: fe.start_date.split('T')[0],
      recurrence_months: String(fe.recurrence_months),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount || !form.category_id || !form.start_date || !form.recurrence_months) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(form.amount);
    const recurrence_months = parseInt(form.recurrence_months);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    if (isNaN(recurrence_months) || recurrence_months < 1) {
      toast({ title: 'Meses de recorrência inválido', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...form, amount, recurrence_months, description: form.description.trim() };
      if (editing) {
        await api.updateFixedExpense(editing.id, payload);
        toast({ title: 'Gasto fixo atualizado!' });
      } else {
        await api.createFixedExpense(payload);
        toast({ title: 'Gasto fixo criado!' });
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este gasto fixo? Transações futuras vinculadas serão removidas.')) return;
    try {
      await api.deleteFixedExpense(id);
      toast({ title: 'Gasto fixo excluído' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const totalMonthly = items.reduce((sum, fe) => sum + parseFloat(String(fe.amount)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gastos Fixos</h1>
          <p className="text-sm text-muted-foreground">Total mensal: {formatCurrency(totalMonthly)}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Novo Gasto Fixo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}</DialogTitle><DialogDescription>{editing ? 'Atualize a recorrência e os dados do gasto fixo.' : 'Crie um gasto recorrente mensal e gere suas transações.'}</DialogDescription></DialogHeader>
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
                  <Label>Data Início</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Meses de Recorrência</Label>
                  <Input type="number" min="1" max="120" value={form.recurrence_months} onChange={(e) => setForm({ ...form, recurrence_months: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full">{editing ? 'Salvar' : 'Criar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead className="text-center">Meses</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum gasto fixo</TableCell></TableRow>
                ) : (
                  items.map((fe) => (
                    <TableRow key={fe.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Repeat className="h-4 w-4 text-muted-foreground" />
                          {fe.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fe.category_name}</TableCell>
                      <TableCell className="text-sm">{new Date(fe.start_date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-center">{fe.recurrence_months}</TableCell>
                      <TableCell className="text-right font-semibold text-[hsl(var(--expense))]">
                        {formatCurrency(fe.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(fe)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(fe.id)}><Trash2 className="h-4 w-4" /></Button>
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
