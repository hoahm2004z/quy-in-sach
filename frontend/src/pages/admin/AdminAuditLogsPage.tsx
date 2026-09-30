import {
  Box,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminGet } from '@/services/adminApi';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import { formatDate, auditActionLabel, entityLabel } from '@/utils/format';

type AuditItem = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  userName: string | null;
};

export function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: async () =>
      adminGet<AuditItem[]>('/api/admin/audit-logs', { page, pageSize: 20 }),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
        Nhật ký
      </Typography>
      <Typography color="text.secondary">
        Chỉ xem — không sửa/xóa nhật ký qua giao diện.
      </Typography>

      {!query.data?.data.length ? (
        <EmptyState title="Chưa có nhật ký" />
      ) : (
        <>
          <Box
            sx={{
              overflow: 'auto',
              bgcolor: 'background.paper',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Thời gian</TableCell>
                  <TableCell>Hành động</TableCell>
                  <TableCell>Đối tượng</TableCell>
                  <TableCell>Người thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.createdAt)}</TableCell>
                    <TableCell>{auditActionLabel(l.action)}</TableCell>
                    <TableCell>{entityLabel(l.entity)}</TableCell>
                    <TableCell>{l.userName || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {(query.data.meta?.totalPages ?? 1) > 1 ? (
            <Stack alignItems="center">
              <Pagination
                page={page}
                count={query.data.meta?.totalPages ?? 1}
                onChange={(_e, v) => setPage(v)}
                color="primary"
              />
            </Stack>
          ) : null}
        </>
      )}
    </Stack>
  );
}
