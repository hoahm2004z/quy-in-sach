import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { adminGet } from '@/services/adminApi';
import { FundStatsStrip } from '@/features/transparency/FundStatsStrip';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import { formatDate, formatVnd, transactionStatusLabel } from '@/utils/format';

type DashboardData = {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    upcomingBudget: number;
  };
  todos: {
    pendingDonations: number;
    pendingExpenses: number;
    incompleteProducts: number;
  };
  upcomingBooks: Array<{ id: string; name: string; budgetEstimate: number }>;
  recentDonations: Array<{
    id: string;
    donorName: string;
    amount: number;
    status: string;
    donatedAt: string;
  }>;
  recentExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    status: string;
    expenseDate: string;
  }>;
};

export function AdminDashboardPage() {
  const query = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await adminGet<DashboardData>('/api/admin/dashboard');
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState />;

  const { summary, todos, upcomingBooks, recentDonations, recentExpenses } = query.data;

  return (
    <Stack spacing={3}>
      <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
        Tổng quan
      </Typography>

      <FundStatsStrip stats={summary} compact />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
        }}
      >
        <TodoCard label="Khoản thu chờ xác nhận" value={todos.pendingDonations} />
        <TodoCard label="Khoản chi chờ xác nhận" value={todos.pendingExpenses} />
        <TodoCard label="Sản phẩm cần bổ sung" value={todos.incompleteProducts} />
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography fontWeight={700} mb={1}>
          Sách sắp in
        </Typography>
        {upcomingBooks.length === 0 ? (
          <EmptyState title="Không có sách sắp in" />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell align="right">Dự toán</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {upcomingBooks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell align="right">{formatVnd(b.budgetEstimate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography fontWeight={700} mb={1}>
            Khoản thu mới
          </Typography>
          <Table size="small">
            <TableBody>
              {recentDonations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Typography variant="body2">{d.donorName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(d.donatedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatVnd(d.amount)}</Typography>
                    <Chip size="small" label={transactionStatusLabel(d.status)} sx={{ mt: 0.5 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography fontWeight={700} mb={1}>
            Khoản chi mới
          </Typography>
          <Table size="small">
            <TableBody>
              {recentExpenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Typography variant="body2">{e.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(e.expenseDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatVnd(e.amount)}</Typography>
                    <Chip size="small" label={transactionStatusLabel(e.status)} sx={{ mt: 0.5 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Stack>
  );
}

function TodoCard({ label, value }: { label: string; value: number }) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={700} mt={0.5}>
        {value}
      </Typography>
    </Paper>
  );
}
