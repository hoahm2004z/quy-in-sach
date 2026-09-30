import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminGet, adminMutate } from '@/services/adminApi';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import { formatDate } from '@/utils/format';

type TrashItem = {
  id: string;
  entity: 'product' | 'donation' | 'expense' | 'companion';
  name: string;
  deletedAt: string | null;
  deleteReason: string | null;
  deletedByName: string | null;
};

const ENTITY_LABEL: Record<TrashItem['entity'], string> = {
  product: 'Sách/Loa',
  donation: 'Khoản thu',
  expense: 'Khoản chi',
  companion: 'Người đồng hành',
};

export function AdminTrashPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'trash'],
    queryFn: async () => {
      const { data } = await adminGet<TrashItem[]>('/api/admin/trash');
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (item: TrashItem) =>
      adminMutate('post', `/api/admin/trash/${item.id}/restore`, {
        entity: item.entity,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'trash'] });
      await qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
        Thùng rác
      </Typography>
      <Typography color="text.secondary">
        Khôi phục dữ liệu đã đưa vào thùng rác. Không xóa vĩnh viễn các giao dịch tài chính.
      </Typography>

      {!query.data?.length ? (
        <EmptyState title="Thùng rác trống" />
      ) : (
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
                <TableCell>Tên</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell>Ngày xóa</TableCell>
                <TableCell>Người xóa</TableCell>
                <TableCell>Lý do</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.data.map((item) => (
                <TableRow key={`${item.entity}-${item.id}`}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{ENTITY_LABEL[item.entity]}</TableCell>
                  <TableCell>{formatDate(item.deletedAt)}</TableCell>
                  <TableCell>{item.deletedByName || '—'}</TableCell>
                  <TableCell>{item.deleteReason || '—'}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => restoreMutation.mutate(item)}
                      disabled={restoreMutation.isPending}
                    >
                      Khôi phục
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Stack>
  );
}
