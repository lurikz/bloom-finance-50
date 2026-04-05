import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Eye, EyeOff, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    if (adminMode && email.trim().toLowerCase() !== 'padilha.ctt@gmail.com') {
      toast({ title: 'Acesso negado', description: 'Este acesso é restrito ao administrador.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(adminMode ? '/admin' : '/');
    } catch (err: any) {
      toast({ title: 'Erro ao entrar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            {adminMode ? <Shield className="h-10 w-10 text-primary" /> : <Wallet className="h-10 w-10 text-primary" />}
          </div>
          <CardTitle className="text-2xl">{adminMode ? 'Admin' : 'FinControl'}</CardTitle>
          <CardDescription>{adminMode ? 'Acesso restrito ao administrador' : 'Entre na sua conta para continuar'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">Esqueceu a senha?</Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : adminMode ? 'Entrar como Admin' : 'Entrar'}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Não tem conta? <Link to="/register" className="text-primary hover:underline">Cadastre-se</Link>
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setAdminMode(!adminMode)}
            >
              <Shield className="h-3.5 w-3.5" />
              {adminMode ? 'Voltar' : 'Admin'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}