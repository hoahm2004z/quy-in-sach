import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminGet, adminMutate } from '@/services/adminApi';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import { MediaUploadField } from '@/components/MediaUploadField';
import { formatDate, formatVnd, transactionStatusLabel } from '@/utils/format';
import {
  intDraftToNumber,
  numberToIntDraft,
  sanitizeIntDraft,
} from '@/utils/numberInput';

type Donation = {
  id: string;
  donorName: string;
  displayName: string | null;
  isAnonymous: boolean;
  amount: number;
  donatedAt: string;
  content: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'VOIDED';
  isPublic: boolean;
  proofMediaId: string | null;
};

function defaultForm() {
  return {
    donorName: '',
    displayName: '',
    isAnonymous: false,
    amount: '',
    donatedAt: new Date().toISOString().slice(0, 16),
    content: '',
    isPublic: true,
    proofMediaId: null as string | null,
  };
}

export function AdminDonationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<Donation | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin', 'donations'],
    queryFn: async () => {
      const { data } = await adminGet<Donation[]>('/api/admin/donations', { pageSize: 50 });
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        donorName: form.donorName,
        displayName: form.displayName || null,
        isAnonymous: form.isAnonymous,
        amount: intDraftToNumber(form.amount),
        donatedAt: new Date(form.donatedAt).toISOString(),
        content: form.content || null,
        isPublic: form.isPublic,
        proofMediaId: form.proofMediaId,
      };
      if (editing) {
        return adminMutate('put', `/api/admin/donations/${editing.id}`, body);
      }
      return adminMutate('post', '/api/admin/donations', body);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      setForm(defaultForm());
      await qc.invalidateQueries({ queryKey: ['admin', 'donations'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'void' }) =>
      adminMutate(
        'post',
        `/api/admin/donations/${id}/${action}`,
        action === 'void' ? { reason: 'Hủy nghiệp vụ' } : undefined,
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'donations'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () =>
      adminMutate('post', `/api/admin/donations/${deleteTarget!.id}/delete`, {
        deleteReason,
      }),
    onSuccess: async () => {
      setDeleteTarget(null);
      setDeleteReason('');
      await qc.invalidateQueries({ queryKey: ['admin', 'donations'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'trash'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setOpen(true);
  }

  function openEdit(d: Donation) {
    setEditing(d);
    setForm({
      donorName: d.donorName,
      displayName: d.displayName || '',
      isAnonymous: d.isAnonymous,
      amount: numberToIntDraft(d.amount),
      donatedAt: new Date(d.donatedAt).toISOString().slice(0, 16),
      content: d.content || '',
      isPublic: d.isPublic,
      proofMediaId: d.proofMediaId,
    });
    setOpen(true);
  }

  if (listQuery.isLoading) return <LoadingState />;
  if (listQuery.isError) return <ErrorState />;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
          Khoản thu
        </Typography>
        <Button variant="contained" onClick={openCreate}>
          Thêm
        </Button>
      </Stack>

      {!listQuery.data?.length ? (
        <EmptyState title="Chưa có khoản thu" />
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
                <TableCell>Ngày</TableCell>
                <TableCell>Người đóng góp</TableCell>
                <TableCell align="right">Số tiền</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{formatDate(d.donatedAt)}</TableCell>
                  <TableCell>
                    {d.donorName}
                    {d.isAnonymous ? ' (ẩn danh)' : ''}
                  </TableCell>
                  <TableCell align="right">{formatVnd(d.amount)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={transactionStatusLabel(d.status)} />
                  </TableCell>
                  <TableCell align="right">
                    {d.status === 'PENDING' ? (
                      <>
                        <Button size="small" onClick={() => openEdit(d)}>
                          Sửa
                        </Button>
                        <Button
                          size="small"
                          onClick={() => actionMutation.mutate({ id: d.id, action: 'confirm' })}
                        >
                          Xác nhận
                        </Button>
                        <Button size="small" color="error" onClick={() => setDeleteTarget(d)}>
                          Xóa
                        </Button>
                      </>
                    ) : null}
                    {d.status !== 'VOIDED' ? (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => actionMutation.mutate({ id: d.id, action: 'void' })}
                      >
                        Hủy giao dịch
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editing ? 'Sửa khoản thu' : 'Thêm khoản thu'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Tên thật (nội bộ)"
              value={form.donorName}
              onChange={(e) => setForm({ ...form, donorName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Tên hiển thị công khai"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Số tiền"
              type="text"
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: sanitizeIntDraft(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Thời điểm"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={form.donatedAt}
              onChange={(e) => setForm({ ...form, donatedAt: e.target.value })}
              fullWidth
            />
            <TextField
              label="Nội dung"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label="Ẩn danh"
              value={form.isAnonymous ? '1' : '0'}
              onChange={(e) => setForm({ ...form, isAnonymous: e.target.value === '1' })}
              fullWidth
            >
              <MenuItem value="0">Không</MenuItem>
              <MenuItem value="1">Có</MenuItem>
            </TextField>
            <TextField
              select
              label="Công khai"
              value={form.isPublic ? '1' : '0'}
              onChange={(e) => setForm({ ...form, isPublic: e.target.value === '1' })}
              fullWidth
            >
              <MenuItem value="1">Có</MenuItem>
              <MenuItem value="0">Không</MenuItem>
            </TextField>
            <MediaUploadField
              purpose="proof"
              label="Ảnh chứng từ"
              mediaId={form.proofMediaId}
              onChange={(proofMediaId) => setForm({ ...form, proofMediaId })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpen(false);
              setEditing(null);
            }}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            disabled={
              !form.donorName || intDraftToNumber(form.amount) <= 0 || saveMutation.isPending
            }
            onClick={() => saveMutation.mutate()}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Xóa khoản thu?</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Dữ liệu sẽ được đưa vào Thùng rác và có thể khôi phục.
          </Typography>
          <TextField
            label="Lý do xóa"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            fullWidth
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Hủy</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!deleteReason.trim() || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
