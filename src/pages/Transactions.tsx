import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Search, Filter, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Transaction { id: string; description: string; amount: number; type: 'income' | 'expense'; category_id: string; category_name: string; date: string; }
interface Category { id: string; name: string; type: string; }
interface Saving { id: string; name: string; current_amount: number; target_amount: number | null; }

export default function Transactions() {
  const { addNotification } = useNotifications();
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

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 20;

  const [form, setForm] = useState({ description: '', amount: '', type: 'expense' as 'income' | 'expense', category_id: '', date: new Date().toISOString().split('T')[0] });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMonths, setRecurrenceMonths] = useState('12');
  const [addToSaving, setAddToSaving] = useState(false);
  const [selectedSavingId, setSelectedSavingId] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hasActiveFilters = searchTerm || filterType !== 'all' || filterCategory !== 'all' || minAmount || maxAmount || dateFrom || dateTo;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} transação(ões)?`)) return;
    try {
      await api.bulkDeleteTransactions(Array.from(selectedIds));
      toast({ title: `${selectedIds.size} transação(ões) excluída(s)` });
      setSelectedIds(new Set());
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const load = (page = currentPage) => {
    setLoading(true);
    const params: any = { page, limit: ITEMS_PER_PAGE };
    if (!useCustomPeriod) { params.month = month; params.year = year; }
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (filterType !== 'all') params.type = filterType;
    if (filterCategory !== 'all') params.category = filterCategory;
    if (minAmount) params.min_amount = parseFloat(minAmount);
    if (maxAmount) params.max_amount = parseFloat(maxAmount);
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    Promise.all([api.getTransactions(params), api.getCategories(), api.getSavings().catch(() => [])])
      .then(([res, c, s]) => {
        setTransactions(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.total);
        setCurrentPage(res.pagination.page);
        setCategories(c);
        setSavings(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterCategory('all');
    setMinAmount('');
    setMaxAmount('');
    setDateFrom('');
    setDateTo('');
    setUseCustomPeriod(false);
    setCurrentPage(1);
  };

  useEffect(() => { load(1); }, [month, year, useCustomPeriod]);

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
        if (addToSaving && selectedSavingId && form.type === 'expense') {
          await api.depositSaving(selectedSavingId, { amount, description: `Depósito via transação: ${form.description.trim()}` });
        }
        addNotification({
          type: form.type === 'income' ? 'income' : 'expense',
          title: form.type === 'income' ? 'Nova receita registrada' : 'Nova despesa registrada',
          description: `${form.description.trim()} — ${formatCurrency(amount)}`,
        });
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
        <div className="flex gap-2 flex-wrap items-center">
          {!useCustomPeriod && (
            <>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>{[2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </>
          )}
          <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5">
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
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
                      <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => { setIsRecurring(e.target.checked); if (e.target.checked) setAddToSaving(false); }} className="h-4 w-4 rounded border-border" />
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
                      <input type="checkbox" id="addToSaving" checked={addToSaving} onChange={(e) => { setAddToSaving(e.target.checked); if (!e.target.checked) setSelectedSavingId(''); }} className="h-4 w-4 rounded border-border" />
                      <Label htmlFor="addToSaving" className="cursor-pointer text-sm">Adicionar a uma economia?</Label>
                    </div>
                    {addToSaving && (
                      <div className="space-y-2">
                        <Label>Economia</Label>
                        <Select value={selectedSavingId} onValueChange={setSelectedSavingId}>
                          <SelectTrigger><SelectValue placeholder="Selecione a economia" /></SelectTrigger>
                          <SelectContent>
                            {savings.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({formatCurrency(s.current_amount)})</SelectItem>)}
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

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && load()}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Type */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Entrada</SelectItem>
                    <SelectItem value="expense">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Min amount */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valor mínimo</Label>
                <Input type="number" step="0.01" min="0" placeholder="R$ 0,00" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
              </div>

              {/* Max amount */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valor máximo</Label>
                <Input type="number" step="0.01" min="0" placeholder="R$ 99.999" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
              </div>
            </div>

            {/* Custom date range */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="customPeriod" checked={useCustomPeriod} onChange={(e) => setUseCustomPeriod(e.target.checked)} className="h-4 w-4 rounded border-border" />
                <Label htmlFor="customPeriod" className="cursor-pointer text-sm">Período personalizado</Label>
              </div>
              {useCustomPeriod && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Data início</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Data fim</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => load(1)} className="gap-1.5">
                <Search className="h-3.5 w-3.5" /> Buscar
              </Button>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={() => { clearFilters(); setTimeout(() => load(1), 0); }} className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Limpar filtros
                </Button>
              )}
              <span className="text-xs text-muted-foreground self-center ml-auto">
                {totalItems} resultado{totalItems !== 1 ? 's' : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
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

          {/* Mobile cards */}
          <div className="md:hidden">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhuma transação</p>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((t) => (
                  <div key={t.id} className="p-4 flex items-center gap-3">
                    <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${t.type === 'income' ? 'bg-accent' : 'bg-destructive/10'}`}>
                      {t.type === 'income' ? <TrendingUp className="h-4 w-4 text-accent-foreground" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.category_name} · {new Date(t.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </p>
                      <div className="flex justify-end gap-0.5 mt-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} · {totalItems} transações
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => load(currentPage - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  className="w-9 h-9 p-0"
                  onClick={() => load(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => load(currentPage + 1)}
              className="gap-1"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
