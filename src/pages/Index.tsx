import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DEFAULT_COLORS = ['hsl(160,84%,39%)','hsl(200,70%,50%)','hsl(280,60%,55%)','hsl(40,90%,55%)','hsl(330,70%,55%)','hsl(100,50%,45%)','hsl(20,80%,50%)','hsl(240,50%,60%)'];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function Dashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getDashboard({ month, year })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year]);

  const balance = (data?.totalIncome || 0) - (data?.totalExpense || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]'}`}>
              {loading ? '...' : formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entradas</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-[hsl(var(--income))]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[hsl(var(--income))]">{loading ? '...' : formatCurrency(data?.totalIncome || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saídas</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-[hsl(var(--expense))]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[hsl(var(--expense))]">{loading ? '...' : formatCurrency(data?.totalExpense || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entradas vs Saídas (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data?.monthlyChart?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="income" name="Entradas" fill="hsl(160,84%,39%)" radius={[4,4,0,0]} />
                    <Bar dataKey="expense" name="Saídas" fill="hsl(0,84%,60%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data?.categoryChart?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.categoryChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {data.categoryChart.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transações recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recentTransactions?.length ? (
            <div className="space-y-3">
              {data.recentTransactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${t.type === 'income' ? 'bg-accent' : 'bg-destructive/10'}`}>
                      {t.type === 'income' ? <TrendingUp className="h-4 w-4 text-[hsl(var(--income))]" /> : <TrendingDown className="h-4 w-4 text-[hsl(var(--expense))]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.category_name} • {new Date(t.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma transação neste mês</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
