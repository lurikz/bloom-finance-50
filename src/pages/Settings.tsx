import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Lock, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [nameLoading, setNameLoading] = useState(false);

  const [email, setEmail] = useState(user?.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const handleName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setNameLoading(true);
    try {
      const updated = await api.updateProfileName(name.trim());
      updateUser(updated);
      toast({ title: '✅ Nome atualizado!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setNameLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !emailPassword) return;
    setEmailLoading(true);
    try {
      const updated = await api.updateProfileEmail(email.trim(), emailPassword);
      updateUser(updated);
      setEmailPassword('');
      toast({ title: '✅ Email atualizado!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Erro', description: 'Nova senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setPassLoading(true);
    try {
      await api.updateProfilePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: '✅ Senha alterada com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <User className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
      </div>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Nome</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleName} className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
            </div>
            <Button type="submit" disabled={nameLoading || name.trim() === user?.name}>
              {nameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Email</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Novo email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-password">Senha atual (confirmação)</Label>
              <Input id="email-password" type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required placeholder="Digite sua senha para confirmar" />
            </div>
            <Button type="submit" disabled={emailLoading || (!emailPassword || email.trim() === user?.email)}>
              {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alterar Email'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pass">Senha atual</Label>
              <Input id="current-pass" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="new-pass">Nova senha</Label>
              <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
              <Input id="confirm-pass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={passLoading || !currentPassword || !newPassword || !confirmPassword}>
              {passLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
