import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, TrendingUp, TrendingDown, Pencil, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  type: string;
  color?: string;
  is_default?: boolean;
}

function GradientColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-3">
      <Label>Cor</Label>
      <div className="relative w-full h-40 rounded-lg overflow-hidden cursor-crosshair border border-border"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const canvas = e.currentTarget.querySelector('canvas');
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
          const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
          onChange(hex);
        }}
      >
        <canvas
          width={360}
          height={160}
          className="w-full h-full"
          ref={(canvas) => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const w = canvas.width;
            const h = canvas.height;
            // Horizontal hue gradient
            const hGrad = ctx.createLinearGradient(0, 0, w, 0);
            hGrad.addColorStop(0, '#ff0000');
            hGrad.addColorStop(0.17, '#ffff00');
            hGrad.addColorStop(0.33, '#00ff00');
            hGrad.addColorStop(0.5, '#00ffff');
            hGrad.addColorStop(0.67, '#0000ff');
            hGrad.addColorStop(0.83, '#ff00ff');
            hGrad.addColorStop(1, '#ff0000');
            ctx.fillStyle = hGrad;
            ctx.fillRect(0, 0, w, h);
            // Vertical white-to-transparent gradient
            const wGrad = ctx.createLinearGradient(0, 0, 0, h / 2);
            wGrad.addColorStop(0, 'rgba(255,255,255,1)');
            wGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = wGrad;
            ctx.fillRect(0, 0, w, h);
            // Vertical transparent-to-black gradient
            const bGrad = ctx.createLinearGradient(0, h / 2, 0, h);
            bGrad.addColorStop(0, 'rgba(0,0,0,0)');
            bGrad.addColorStop(1, 'rgba(0,0,0,1)');
            ctx.fillStyle = bGrad;
            ctx.fillRect(0, 0, w, h);
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-border flex-shrink-0" style={{ backgroundColor: value }} />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          className="w-28 font-mono text-sm"
          placeholder="#000000"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
        />
      </div>
    </div>
  );
}

function CategoryItem({
  c,
  onEdit,
  onDelete,
}: {
  c: Category;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/50">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full flex-shrink-0 border border-border" style={{ backgroundColor: c.color || '#9CA3AF' }} />
        <span className="text-sm font-medium text-foreground">{c.name}</span>
        {c.is_default && <Lock className="h-3 w-3 text-muted-foreground" />}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onEdit(c)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {!c.is_default && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(c.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
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

  const load = useCallback(() => {
    setLoading(true);
    api.getCategories().then(setCategories).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova categoria</DialogTitle>
              <DialogDescription>Crie uma categoria personalizada com cor.</DialogDescription>
            </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
            <DialogDescription>Altere o nome ou a cor da categoria.</DialogDescription>
          </DialogHeader>
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
                {incomeCategories.map((c) => (
                  <CategoryItem key={c.id} c={c} onEdit={openEdit} onDelete={handleDelete} />
                ))}
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
                {expenseCategories.map((c) => (
                  <CategoryItem key={c.id} c={c} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
