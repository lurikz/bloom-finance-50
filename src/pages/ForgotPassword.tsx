import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Informe o email', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Recuperar senha</CardTitle>
          <CardDescription>{sent ? 'Verifique seu email' : 'Enviaremos um link para redefinir sua senha'}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">Se o email estiver cadastrado, você receberá um link para redefinir sua senha.</p>
              <Link to="/login">
                <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link'}
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-primary hover:underline">Voltar ao login</Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
