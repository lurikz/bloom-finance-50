import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import GradientColorPicker from '@/components/GradientColorPicker';
import { Plus, Trash2, TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  type: string;
  color?: string;
}


export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState('#10B981');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    api.getCategories().then(setCategories).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Informe o nome', variant: 'destructive' });
      return;
    }
    try {
      await api.createCategory({ name: name.trim(), type, color });
      toast({ title: 'Categoria criada!' });
      setName('');
      setColor('#10B981');
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDialog) return;
    try {
      await api.updateCategory(editDialog.id, { name: editName.trim() || undefined, color: editColor });
      toast({ title: 'Categoria atualizada!' });
      setEditDialog(null);
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      await api.deleteCategory(id);
      toast({ title: 'Categoria excluída' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const openEdit = (c: Category) => {
    setEditName(c.name);
    setEditColor(c.color || '#10B981');
    setEditDialog(c);
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const CategoryItem = ({ c }: { c: Category }) => (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/50">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full flex-shrink-0 border border-border" style={{ backgroundColor: c.color || '#9CA3AF' }} />
        <span className="text-sm font-medium text-foreground">{c.name}</span>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(c)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova categoria</DialogTitle><DialogDescription>Crie uma categoria com cor personalizada.</DialogDescription></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Alimentação" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v: 'income' | 'expense') => setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Entrada</SelectItem>
                    <SelectItem value="expense">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <GradientColorPicker value={color} onChange={setColor} />
              <Button type="submit" className="w-full">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar categoria</DialogTitle><DialogDescription>Altere o nome ou a cor.</DialogDescription></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input maxLength={50} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <GradientColorPicker value={editColor} onChange={setEditColor} />
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--income))]" /> Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : incomeCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria de entrada</p>
            ) : (
              <div className="space-y-2">
                {incomeCategories.map((c) => <CategoryItem key={c.id} c={c} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-[hsl(var(--expense))]" /> Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : expenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria de saída</p>
            ) : (
              <div className="space-y-2">
                {expenseCategories.map((c) => <CategoryItem key={c.id} c={c} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
