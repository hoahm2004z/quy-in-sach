import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Box,
  Container,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDonations,
  fetchExpenses,
  fetchStatistics,
} from '@/services/publicApi';
import { FundStatsStrip } from '@/features/transparency/FundStatsStrip';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import { formatDate, formatVnd } from '@/utils/format';

export function TransparencyPage() {
  const [tab, setTab] = useState(0);
  const [donationPage, setDonationPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);

  const statsQuery = useQuery({
    queryKey: ['public', 'statistics'],
    queryFn: fetchStatistics,
  });

  const donationsQuery = useQuery({
    queryKey: ['public', 'donations', donationPage],
    queryFn: () => fetchDonations(donationPage, 20),
  });

  const expensesQuery = useQuery({
    queryKey: ['public', 'expenses', expensePage],
    queryFn: () => fetchExpenses(expensePage, 20),
  });

  return (
    <Container maxWidth="lg">
      <Stack spacing={4}>
        <Box>
          <Typography
            component="h1"
            variant="h3"
            sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 1 }}
          >
            Minh bạch thu – chi
          </Typography>
          <Typography color="text.secondary">
            Các khoản thu và chi đã xác nhận, được phép công khai.
          </Typography>
        </Box>

        {statsQuery.isLoading ? <LoadingState minHeight={160} /> : null}
        {statsQuery.isError ? <ErrorState /> : null}
        {statsQuery.data ? <FundStatsStrip stats={statsQuery.data} /> : null}

        <Box>
          <Tabs
            value={tab}
            onChange={(_e, value: number) => setTab(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ mb: 2 }}
          >
            <Tab label="Khoản thu" />
            <Tab label="Khoản chi" />
          </Tabs>

          {tab === 0 ? (
            <TransactionPanel
              loading={donationsQuery.isLoading}
              error={donationsQuery.isError}
              empty={!donationsQuery.data?.data.length}
              emptyTitle="Chưa có khoản thu công khai"
              page={donationPage}
              totalPages={donationsQuery.data?.meta?.totalPages ?? 1}
              onPageChange={setDonationPage}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ngày</TableCell>
                    <TableCell>Người đóng góp</TableCell>
                    <TableCell>Nội dung</TableCell>
                    <TableCell align="right">Số tiền</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {donationsQuery.data?.data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{formatDate(d.donatedAt)}</TableCell>
                      <TableCell>{d.displayName}</TableCell>
                      <TableCell>{d.content || '—'}</TableCell>
                      <TableCell align="right">{formatVnd(d.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TransactionPanel>
          ) : (
            <TransactionPanel
              loading={expensesQuery.isLoading}
              error={expensesQuery.isError}
              empty={!expensesQuery.data?.data.length}
              emptyTitle="Chưa có khoản chi công khai"
              page={expensePage}
              totalPages={expensesQuery.data?.meta?.totalPages ?? 1}
              onPageChange={setExpensePage}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ngày</TableCell>
                    <TableCell>Nội dung</TableCell>
                    <TableCell>Sản phẩm</TableCell>
                    <TableCell align="right">Số tiền</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expensesQuery.data?.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.expenseDate)}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>{e.product?.name || '—'}</TableCell>
                      <TableCell align="right">{formatVnd(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TransactionPanel>
          )}
        </Box>
      </Stack>
    </Container>
  );
}

function TransactionPanel({
  loading,
  error,
  empty,
  emptyTitle,
  page,
  totalPages,
  onPageChange,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyTitle: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;
  if (empty) return <EmptyState title={emptyTitle} />;

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'auto',
          bgcolor: 'background.paper',
        }}
      >
        {children}
      </Box>
      {totalPages > 1 ? (
        <Stack alignItems="center">
          <Pagination
            page={page}
            count={totalPages}
            color="primary"
            onChange={(_e, value) => onPageChange(value)}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
