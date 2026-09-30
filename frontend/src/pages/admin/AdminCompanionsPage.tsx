import {
  Box,
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
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminGet, adminMutate } from '@/services/adminApi';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import {
  intDraftToNumber,
  numberToIntDraft,
  sanitizeIntDraft,
} from '@/utils/numberInput';

type Companion = {
  id: string;
  displayName: string;
  note: string | null;
  isPublic: boolean;
  sortOrder: number;
};

const emptyForm = {
  displayName: '',
  note: '',
  isPublic: true,
  sortOrder: '',
};

export function AdminCompanionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Companion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin', 'companions'],
    queryFn: async () => {
      const { data } = await adminGet<Companion[]>('/api/admin/companions');
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        displayName: form.displayName.trim(),
        note: form.note.trim() || null,
        isPublic: form.isPublic,
        sortOrder: intDraftToNumber(form.sortOrder),
      };
      if (editing) {
        return adminMutate('put', `/api/admin/companions/${editing.id}`, body);
      }
      return adminMutate('post', '/api/admin/companions', body);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await qc.invalidateQueries({ queryKey: ['admin', 'companions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      adminMutate('post', `/api/admin/companions/${deleteId}/delete`, {
        deleteReason,
      }),
    onSuccess: async () => {
      setDeleteId(null);
      setDeleteReason('');
      await qc.invalidateQueries({ queryKey: ['admin', 'companions'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'trash'] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Companion) {
    setEditing(c);
    setForm({
      displayName: c.displayName,
      note: c.note || '',
      isPublic: c.isPublic,
      sortOrder: numberToIntDraft(c.sortOrder),
    });
    setOpen(true);
  }

  if (listQuery.isLoading) return <LoadingState />;
  if (listQuery.isError) return <ErrorState />;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
          Người đồng hành
        </Typography>
        <Button variant="contained" onClick={openCreate}>
          Thêm
        </Button>
      </Stack>

      {!listQuery.data?.length ? (
        <EmptyState title="Chưa có người đồng hành" />
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
                <TableCell>Tên hiển thị</TableCell>
                <TableCell>Ghi chú</TableCell>
                <TableCell>Công khai</TableCell>
                <TableCell>Thứ tự</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.displayName}</TableCell>
                  <TableCell>{c.note || '—'}</TableCell>
                  <TableCell>{c.isPublic ? 'Có' : 'Không'}</TableCell>
                  <TableCell>{c.sortOrder}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(c)}>
                      Sửa
                    </Button>
                    <Button size="small" color="error" onClick={() => setDeleteId(c.id)}>
                      Xóa
                    </Button>
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
        <DialogTitle>
          {editing ? 'Sửa người đồng hành' : 'Thêm người đồng hành'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Tên hiển thị"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Ghi chú"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              fullWidth
            />
            <TextField
              label="Thứ tự"
              type="text"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: sanitizeIntDraft(e.target.value) })}
              fullWidth
            />
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
            {saveMutation.isError ? (
              <Typography color="error">Không lưu được. Vui lòng thử lại.</Typography>
            ) : null}
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
            disabled={!form.displayName.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Xóa người đồng hành?</DialogTitle>
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
          <Button onClick={() => setDeleteId(null)}>Hủy</Button>
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
