import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Database, CheckCircle, XCircle, Loader2, RefreshCw, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DbStatus {
  tables: string[];
  counts: Record<string, number>;
  hasFixedExpenseColumn: boolean;
}

export default function Admin() {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDbStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleInitDb = async () => {
    setInitializing(true);
    try {
      const result = await api.initDb();
      toast({ title: '✅ Sucesso!', description: result.message });
      await loadStatus();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setInitializing(false);
    }
  };

  const handleSyncCategories = async () => {
    setSyncing(true);
    try {
      const result = await api.syncCategories();
      toast({ title: '✅ Categorias sincronizadas!', description: result.message });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const requiredTables = ['users', 'categories', 'transactions', 'fixed_expenses'];
  const allTablesExist = status ? requiredTables.every(t => status.tables.includes(t)) : false;
  const isFullyReady = allTablesExist && status?.hasFixedExpenseColumn;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Administração</h1>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar Status
        </Button>
      </div>

      {/* Backend status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> Status do Backend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão...
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Backend indisponível</span>
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {isFullyReady ? (
                  <><CheckCircle className="h-5 w-5 text-primary" /><span className="font-medium text-primary">Backend totalmente configurado</span></>
                ) : (
                  <><XCircle className="h-5 w-5 text-amber-500" /><span className="font-medium text-amber-500">Schema incompleto</span></>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Tabelas:</p>
                <div className="flex flex-wrap gap-2">
                  {requiredTables.map(table => {
                    const exists = status?.tables.includes(table);
                    return (
                      <Badge key={table} variant={exists ? 'default' : 'destructive'} className="gap-1">
                        {exists ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {table}
                        {exists && status?.counts[table] !== undefined && <span className="ml-1 opacity-70">({status.counts[table]})</span>}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> Implementar Schema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cria ou atualiza tabelas e colunas. Seguro para rodar múltiplas vezes.
            </p>
            <Button className="gap-2 w-full" onClick={handleInitDb} disabled={initializing || loading || !!error}>
              {initializing ? <><Loader2 className="h-4 w-4 animate-spin" /> Implementando...</> : <><Database className="h-4 w-4" /> Implementar no Backend</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Sincronizar Categorias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Insere as categorias padrão para todos os usuários existentes, sem sobrescrever personalizações.
            </p>
            <Button variant="outline" className="gap-2 w-full" onClick={handleSyncCategories} disabled={syncing || loading || !!error}>
              {syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Sincronizando...</> : <><Users className="h-4 w-4" /> Sincronizar Categorias</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
