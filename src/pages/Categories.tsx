import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#06B6D4', '#A855F7',
];

interface Category { id: string; name: string; type: string; color?: string; is_default?: boolean; }

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState(PRESET_COLORS[0]);
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
      setColor(PRESET_COLORS[0]);
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
    setEditColor(c.color || PRESET_COLORS[0]);
    setEditDialog(c);
  };

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="space-y-2">
      <Label>Cor</Label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${value === c ? 'border-foreground scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} className="w-24 font-mono text-xs" placeholder="#000000" />
      </div>
    </div>
  );

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const CategoryItem = ({ c }: { c: Category }) => (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/50">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#9CA3AF' }} />
        <span className="text-sm font-medium text-foreground">{c.name}</span>
      </div>
      <div className="flex gap-1">
        {!c.is_default && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(c)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
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
            <DialogHeader><DialogTitle>Nova categoria</DialogTitle><DialogDescription>Crie uma categoria personalizada com cor.</DialogDescription></DialogHeader>
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
              <ColorPicker value={color} onChange={setColor} />
              <Button type="submit" className="w-full">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar categoria</DialogTitle><DialogDescription>Altere o nome ou a cor da categoria.</DialogDescription></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input maxLength={50} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <ColorPicker value={editColor} onChange={setEditColor} />
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
