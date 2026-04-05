import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownRight, Wallet, FileText, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function Reports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    api.getMonthlyReport({ month, year })
      .then(setData)
      .catch(() => toast({ title: 'Erro ao carregar relatório', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [month, year]);

  const summary = data?.summary;
  const expenseCategories = data?.byCategory?.filter((c: any) => c.type === 'expense') || [];
  const incomeCategories = data?.byCategory?.filter((c: any) => c.type === 'income') || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Relatório Mensal</h1>
        </div>
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !summary ? (
        <p className="text-center text-muted-foreground py-20">Sem dados para exibir</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do Mês</CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-[hsl(var(--income))]' : 'text-[hsl(var(--expense))]'}`}>
                  {formatCurrency(summary.balance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{summary.totalTransactions} transações</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Entradas</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-[hsl(var(--income))]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[hsl(var(--income))]">{formatCurrency(summary.totalIncome)}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary.incomeCount} transações</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Saídas</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-[hsl(var(--expense))]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[hsl(var(--expense))]">{formatCurrency(summary.totalExpense)}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary.expenseCount} transações</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily chart */}
          {data.daily?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Movimentação Diária</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).getDate().toString()} className="text-xs fill-muted-foreground" />
                      <YAxis className="text-xs fill-muted-foreground" />
                      <Tooltip
                        labelFormatter={(d: string) => new Date(d).toLocaleDateString('pt-BR')}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Bar dataKey="income" name="Entradas" fill="hsl(160,84%,39%)" radius={[3,3,0,0]} />
                      <Bar dataKey="expense" name="Saídas" fill="hsl(0,84%,60%)" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-[hsl(var(--expense))]" /> Saídas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expenseCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem saídas</p>
                ) : (
                  <div className="space-y-3">
                    {expenseCategories.map((c: any, i: number) => {
                      const pct = summary.totalExpense > 0 ? (c.total / summary.totalExpense * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-foreground">{c.category}</span>
                            <span className="text-muted-foreground">{formatCurrency(c.total)} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-destructive/70 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-[hsl(var(--income))]" /> Entradas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incomeCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem entradas</p>
                ) : (
                  <div className="space-y-3">
                    {incomeCategories.map((c: any, i: number) => {
                      const pct = summary.totalIncome > 0 ? (c.total / summary.totalIncome * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-foreground">{c.category}</span>
                            <span className="text-muted-foreground">{formatCurrency(c.total)} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top expenses */}
          {data.topExpenses?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Maiores Gastos do Mês</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topExpenses.map((t: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.description}</TableCell>
                        <TableCell className="text-muted-foreground">{t.category}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-semibold text-[hsl(var(--expense))]">{formatCurrency(t.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
