import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    if (password !== confirmPw) {
      toast({ title: 'Senhas não conferem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      toast({ title: 'Senha redefinida com sucesso!' });
      navigate('/login');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 space-y-4">
            <p className="text-muted-foreground">Link inválido ou expirado.</p>
            <Link to="/forgot-password"><Button>Solicitar novo link</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><Wallet className="h-10 w-10 text-primary" /></div>
          <CardTitle className="text-2xl">Nova senha</CardTitle>
          <CardDescription>Defina sua nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPw">Confirmar senha</Label>
              <Input id="confirmPw" type="password" placeholder="Repita a senha" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Redefinindo...' : 'Redefinir senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
