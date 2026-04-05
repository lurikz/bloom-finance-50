import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Database, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
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
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={loadStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar Status
          </Button>
        </div>
      </div>

      {/* Backend connection status */}
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
              <p className="text-sm text-muted-foreground">
                O backend está retornando erro 502. Verifique se o serviço está rodando no EasyPanel e faça um redeploy se necessário.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
              {isFullyReady ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span className="font-medium text-primary">Backend totalmente configurado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-amber-500" />
                    <span className="font-medium text-amber-500">Schema incompleto — clique em Implementar</span>
                  </>
                )}
              </div>

              {/* Tables */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Tabelas do banco:</p>
                <div className="flex flex-wrap gap-2">
                  {requiredTables.map(table => {
                    const exists = status?.tables.includes(table);
                    return (
                      <Badge key={table} variant={exists ? 'default' : 'destructive'} className="gap-1">
                        {exists ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {table}
                        {exists && status?.counts[table] !== undefined && (
                          <span className="ml-1 opacity-70">({status.counts[table]})</span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Column check */}
              <div className="flex items-center gap-2 text-sm">
              {status?.hasFixedExpenseColumn ? (
                  <><CheckCircle className="h-4 w-4 text-primary" /> Coluna <code className="bg-secondary px-1 rounded text-xs">fixed_expense_id</code> existe em transactions</>
                ) : (
                  <><XCircle className="h-4 w-4 text-amber-500" /> Coluna <code className="bg-secondary px-1 rounded text-xs">fixed_expense_id</code> não encontrada — necessita implementar</>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Init DB action */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Implementar no Backend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo para criar ou atualizar o schema do banco de dados. 
            Isso irá criar as tabelas que faltam, adicionar colunas novas e inserir as categorias padrão.
            É seguro rodar múltiplas vezes — não remove dados existentes.
          </p>
          <Button 
            className="gap-2" 
            size="lg" 
            onClick={handleInitDb} 
            disabled={initializing || loading || !!error}
          >
            {initializing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Implementando...</>
            ) : (
              <><Database className="h-4 w-4" /> Implementar no Backend</>
            )}
          </Button>
          {isFullyReady && !initializing && (
            <p className="text-sm text-[hsl(var(--income))]">
              ✅ Tudo pronto! O backend está configurado e funcionando.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
