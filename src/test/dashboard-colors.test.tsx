import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/pages/Index';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    getDashboard: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: ({ fill }: any) => <div data-testid="chart-cell" data-fill={fill} />,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: ({ dataKey, fill }: any) => <div data-testid={`bar-${dataKey}`} data-fill={fill} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const mockedGetDashboard = vi.mocked(api.getDashboard);

describe('Dashboard category colors', () => {
  beforeEach(() => {
    mockedGetDashboard.mockReset();
  });

  it('uses the saved category color in the dashboard chart', async () => {
    mockedGetDashboard.mockResolvedValue({
      totalIncome: 5000,
      totalExpense: 1200,
      monthlyChart: [{ month: 'Abr', income: 5000, expense: 1200 }],
      categoryChart: [{ name: 'Saúde', value: 400, color: '#123ABC' }],
      recentTransactions: [
        {
          id: '1',
          description: 'Consulta',
          type: 'expense',
          category_name: 'Saúde',
          date: '2026-04-01T00:00:00.000Z',
          amount: 400,
        },
      ],
    });

    render(<Dashboard />);

    await waitFor(() => expect(mockedGetDashboard).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('chart-cell')).toHaveAttribute('data-fill', '#123ABC'));
  });
});
