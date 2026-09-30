import {
  Box,
  Button,
  Chip,
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
import { MediaUploadField } from '@/components/MediaUploadField';
import { formatDate, formatVnd, transactionStatusLabel } from '@/utils/format';
import {
  intDraftToNumber,
  numberToIntDraft,
  sanitizeIntDraft,
} from '@/utils/numberInput';

const PRINT_CATEGORY = 'In ấn';

type Expense = {
  id: string;
  productId: string | null;
  category: string;
  amount: number;
  expenseDate: string;
  description: string;
  status: 'PENDING' | 'CONFIRMED' | 'VOIDED';
  isPublic: boolean;
  invoiceMediaId: string | null;
};

type ProductOption = {
  id: string;
  name: string;
  productType: 'BOOK' | 'SPEAKER';
  status: string;
};

function defaultForm() {
  return {
    category: PRINT_CATEGORY,
    productId: '' as string,
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    description: '',
    isPublic: true,
    invoiceMediaId: null as string | null,
  };
}

function requiresProduct(category: string) {
  return category.trim() === PRINT_CATEGORY;
}

async function invalidateExpenseRelated(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['admin', 'expenses'] }),
    qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    qc.invalidateQueries({ queryKey: ['admin', 'products'] }),
    qc.invalidateQueries({ queryKey: ['public', 'products'] }),
    qc.invalidateQueries({ queryKey: ['public', 'statistics'] }),
    qc.invalidateQueries({ queryKey: ['public', 'expenses'] }),
  ]);
}

export function AdminExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin', 'expenses'],
    queryFn: async () => {
      const { data } = await adminGet<Expense[]>('/api/admin/expenses', { pageSize: 50 });
      return data;
    },
  });

  const productsQuery = useQuery({
    queryKey: ['admin', 'products', 'expense-options'],
    queryFn: async () => {
      const { data } = await adminGet<ProductOption[]>('/api/admin/products', {
        pageSize: 100,
      });
      return data;
    },
  });

  const productNameById = new Map(
    (productsQuery.data ?? []).map((p) => [p.id, p.name] as const),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        category: form.category.trim(),
        productId: form.productId || null,
        amount: intDraftToNumber(form.amount),
        expenseDate: form.expenseDate,
        description: form.description,
        isPublic: form.isPublic,
        invoiceMediaId: form.invoiceMediaId,
      };
      if (editing) {
        return adminMutate('put', `/api/admin/expenses/${editing.id}`, body);
      }
      return adminMutate('post', '/api/admin/expenses', body);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      setForm(defaultForm());
      await invalidateExpenseRelated(qc);
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'void' }) =>
      adminMutate(
        'post',
        `/api/admin/expenses/${id}/${action}`,
        action === 'void' ? { reason: 'Hủy nghiệp vụ' } : undefined,
      ),
    onSuccess: async () => {
      await invalidateExpenseRelated(qc);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () =>
      adminMutate('post', `/api/admin/expenses/${deleteTarget!.id}/delete`, {
        deleteReason,
      }),
    onSuccess: async () => {
      setDeleteTarget(null);
      setDeleteReason('');
      await qc.invalidateQueries({ queryKey: ['admin', 'trash'] });
      await invalidateExpenseRelated(qc);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      category: e.category,
      productId: e.productId || '',
      amount: numberToIntDraft(e.amount),
      expenseDate: String(e.expenseDate).slice(0, 10),
      description: e.description,
      isPublic: e.isPublic,
      invoiceMediaId: e.invoiceMediaId,
    });
    setOpen(true);
  }

  const productRequired = requiresProduct(form.category);
  const canSave =
    Boolean(form.description.trim()) &&
    intDraftToNumber(form.amount) > 0 &&
    (!productRequired || Boolean(form.productId)) &&
    !saveMutation.isPending;

  if (listQuery.isLoading) return <LoadingState />;
  if (listQuery.isError) return <ErrorState />;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
          Khoản chi
        </Typography>
        <Button variant="contained" onClick={openCreate}>
          Thêm
        </Button>
      </Stack>

      {!listQuery.data?.length ? (
        <EmptyState title="Chưa có khoản chi" />
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
                <TableCell>Nội dung</TableCell>
                <TableCell>Sách / Loa</TableCell>
                <TableCell align="right">Số tiền</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.expenseDate)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{e.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {e.category}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {e.productId
                      ? productNameById.get(e.productId) || '—'
                      : '—'}
                  </TableCell>
                  <TableCell align="right">{formatVnd(e.amount)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={transactionStatusLabel(e.status)} />
                  </TableCell>
                  <TableCell align="right">
                    {e.status === 'PENDING' ? (
                      <>
                        <Button size="small" onClick={() => openEdit(e)}>
                          Sửa
                        </Button>
                        <Button
                          size="small"
                          onClick={() => actionMutation.mutate({ id: e.id, action: 'confirm' })}
                        >
                          Xác nhận
                        </Button>
                        <Button size="small" color="error" onClick={() => setDeleteTarget(e)}>
                          Xóa
                        </Button>
                      </>
                    ) : null}
                    {e.status !== 'VOIDED' ? (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => actionMutation.mutate({ id: e.id, action: 'void' })}
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
        <DialogTitle>{editing ? 'Sửa khoản chi' : 'Thêm khoản chi'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              label="Danh mục"
              value={form.category}
              onChange={(e) => {
                const category = e.target.value;
                setForm({
                  ...form,
                  category,
                  productId: requiresProduct(category) ? form.productId : form.productId,
                });
              }}
              fullWidth
            >
              <MenuItem value="In ấn">In ấn</MenuItem>
              <MenuItem value="Vận chuyển">Vận chuyển</MenuItem>
              <MenuItem value="Thiết bị">Thiết bị</MenuItem>
              <MenuItem value="Khác">Khác</MenuItem>
            </TextField>
            <TextField
              select
              label="Sách / Loa liên quan"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              fullWidth
              required={productRequired}
              helperText={
                productRequired
                  ? 'Bắt buộc với danh mục In ấn (tính vào chi phí thực tế của sách/loa)'
                  : 'Tùy chọn nếu khoản chi không gắn một sản phẩm cụ thể'
              }
            >
              <MenuItem value="">
                <em>{productRequired ? '— Chọn sách/loa —' : '— Không gắn sản phẩm —'}</em>
              </MenuItem>
              {(productsQuery.data ?? []).map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Mô tả"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              fullWidth
              required
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
              label="Ngày chi"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
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
            <MediaUploadField
              purpose="invoice"
              label="Hóa đơn / chứng từ"
              mediaId={form.invoiceMediaId}
              onChange={(invoiceMediaId) => setForm({ ...form, invoiceMediaId })}
            />
            {saveMutation.isError ? (
              <Typography color="error">
                Không lưu được. Kiểm tra danh mục In ấn đã chọn Sách/Loa chưa.
              </Typography>
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
            disabled={!canSave}
            onClick={() => saveMutation.mutate()}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Xóa khoản chi?</DialogTitle>
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
