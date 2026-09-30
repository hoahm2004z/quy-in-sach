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
import { formatVnd, productStatusLabel } from '@/utils/format';
import {
  intDraftToNumber,
  numberToIntDraft,
  sanitizeIntDraft,
} from '@/utils/numberInput';

type AdminProduct = {
  id: string;
  name: string;
  productType: 'BOOK' | 'SPEAKER';
  status: 'UPCOMING' | 'PRINTED' | 'ARCHIVED';
  budgetEstimate: number;
  actualCost: number;
  plannedQuantity: number;
  printedQuantity: number;
  stockQuantity: number;
  plannedDate: string | null;
  completedDate: string | null;
  isPublic: boolean;
  description: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
};

const emptyForm = {
  name: '',
  productType: 'BOOK' as 'BOOK' | 'SPEAKER',
  status: 'UPCOMING' as 'UPCOMING' | 'PRINTED',
  budgetEstimate: '',
  plannedQuantity: '',
  printedQuantity: '',
  stockQuantity: '',
  plannedDate: '',
  completedDate: '',
  description: '',
  isPublic: true,
  coverMediaId: null as string | null,
  coverUrl: null as string | null,
};

export function AdminProductsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState<AdminProduct | null>(null);
  const [unarchiveStatus, setUnarchiveStatus] = useState<'UPCOMING' | 'PRINTED'>('UPCOMING');

  const listQuery = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: async () => {
      const { data } = await adminGet<AdminProduct[]>('/api/admin/products', {
        pageSize: 50,
      });
      return data;
    },
  });

  async function refreshProductQueries() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin', 'products'] }),
      qc.invalidateQueries({ queryKey: ['public', 'products'] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        productType: form.productType,
        status: form.status,
        budgetEstimate: intDraftToNumber(form.budgetEstimate),
        plannedQuantity: intDraftToNumber(form.plannedQuantity),
        printedQuantity: intDraftToNumber(form.printedQuantity),
        stockQuantity: intDraftToNumber(form.stockQuantity),
        plannedDate: form.plannedDate || null,
        completedDate: form.completedDate || null,
        description: form.description || null,
        isPublic: form.isPublic,
        coverMediaId: form.coverMediaId,
      };
      if (editing) {
        return adminMutate('put', `/api/admin/products/${editing.id}`, body);
      }
      return adminMutate('post', '/api/admin/products', body);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await refreshProductQueries();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () =>
      adminMutate('post', `/api/admin/products/${deleteTarget!.id}/delete`, {
        deleteReason,
      }),
    onSuccess: async () => {
      setDeleteTarget(null);
      setDeleteReason('');
      await refreshProductQueries();
      await qc.invalidateQueries({ queryKey: ['admin', 'trash'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => adminMutate('post', `/api/admin/products/${id}/archive`),
    onSuccess: async () => {
      setArchiveTarget(null);
      await refreshProductQueries();
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const p = unarchiveTarget!;
      const body: Record<string, unknown> = { status: unarchiveStatus };
      if (unarchiveStatus === 'PRINTED') {
        if (!p.completedDate) {
          body.completedDate = new Date().toISOString().slice(0, 10);
        }
        if (p.printedQuantity <= 0) {
          body.printedQuantity = Math.max(p.plannedQuantity, 1);
        }
      }
      return adminMutate('put', `/api/admin/products/${p.id}`, body);
    },
    onSuccess: async () => {
      setUnarchiveTarget(null);
      await refreshProductQueries();
    },
  });

  if (listQuery.isLoading) return <LoadingState />;
  if (listQuery.isError) return <ErrorState />;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
            Sách & Loa
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Lưu trữ sẽ ẩn khỏi trang công khai — không nhầm với Xóa (đưa vào thùng rác).
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          Thêm
        </Button>
      </Stack>

      {!listQuery.data?.length ? (
        <EmptyState title="Chưa có sản phẩm" />
      ) : (
        <Box sx={{ overflow: 'auto', bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Dự toán</TableCell>
                <TableCell align="right">Chi phí thực tế</TableCell>
                <TableCell>Công khai</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.data.map((p) => (
                <TableRow key={p.id} sx={p.status === 'ARCHIVED' ? { opacity: 0.72 } : undefined}>
                  <TableCell>
                    <Typography fontWeight={600}>{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Số lượng: {p.plannedQuantity} · Tồn kho: {p.stockQuantity}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={p.status === 'ARCHIVED' ? 'default' : 'primary'}
                      variant={p.status === 'ARCHIVED' ? 'outlined' : 'filled'}
                      label={productStatusLabel(p.productType, p.status)}
                    />
                    {p.status === 'ARCHIVED' ? (
                      <Typography variant="caption" display="block" color="warning.main">
                        Không hiện trên Public
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell align="right">{formatVnd(p.budgetEstimate)}</TableCell>
                  <TableCell align="right">{formatVnd(p.actualCost)}</TableCell>
                  <TableCell>{p.isPublic ? 'Có' : 'Không'}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => {
                        setEditing(p);
                        setForm({
                          name: p.name,
                          productType: p.productType,
                          status: p.status === 'ARCHIVED' ? 'PRINTED' : p.status,
                          budgetEstimate: numberToIntDraft(p.budgetEstimate),
                          plannedQuantity: numberToIntDraft(p.plannedQuantity),
                          printedQuantity: numberToIntDraft(p.printedQuantity),
                          stockQuantity: numberToIntDraft(p.stockQuantity),
                          plannedDate: p.plannedDate ? String(p.plannedDate).slice(0, 10) : '',
                          completedDate: p.completedDate
                            ? String(p.completedDate).slice(0, 10)
                            : '',
                          description: p.description || '',
                          isPublic: p.isPublic,
                          coverMediaId: p.coverMediaId,
                          coverUrl: p.coverUrl,
                        });
                        setOpen(true);
                      }}
                    >
                      Sửa
                    </Button>
                    {p.status === 'ARCHIVED' ? (
                      <Button
                        size="small"
                        color="success"
                        onClick={() => {
                          setUnarchiveStatus(
                            p.printedQuantity > 0 || p.completedDate ? 'PRINTED' : 'UPCOMING',
                          );
                          setUnarchiveTarget(p);
                        }}
                      >
                        Hiện lại Public
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => setArchiveTarget(p)}
                      >
                        Ẩn khỏi Public
                      </Button>
                    )}
                    <Button size="small" color="error" onClick={() => setDeleteTarget(p)}>
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Sửa' : 'Thêm sản phẩm'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Tên"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              select
              label="Loại"
              value={form.productType}
              onChange={(e) =>
                setForm({ ...form, productType: e.target.value as 'BOOK' | 'SPEAKER' })
              }
              fullWidth
            >
              <MenuItem value="BOOK">Sách</MenuItem>
              <MenuItem value="SPEAKER">Loa pháp thoại</MenuItem>
            </TextField>
            <TextField
              select
              label="Trạng thái"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as 'UPCOMING' | 'PRINTED',
                })
              }
              fullWidth
            >
              <MenuItem value="UPCOMING">Sắp in / sắp thực hiện</MenuItem>
              <MenuItem value="PRINTED">Đã in / đã hoàn thành</MenuItem>
            </TextField>
            <TextField
              label="Dự toán (VND)"
              type="text"
              inputMode="numeric"
              value={form.budgetEstimate}
              onChange={(e) =>
                setForm({ ...form, budgetEstimate: sanitizeIntDraft(e.target.value) })
              }
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Số lượng dự kiến"
                type="text"
                inputMode="numeric"
                value={form.plannedQuantity}
                onChange={(e) =>
                  setForm({ ...form, plannedQuantity: sanitizeIntDraft(e.target.value) })
                }
                fullWidth
              />
              <TextField
                label="Số lượng đã in"
                type="text"
                inputMode="numeric"
                value={form.printedQuantity}
                onChange={(e) =>
                  setForm({ ...form, printedQuantity: sanitizeIntDraft(e.target.value) })
                }
                fullWidth
              />
            </Stack>
            <TextField
              label="Tồn kho"
              type="text"
              inputMode="numeric"
              value={form.stockQuantity}
              onChange={(e) =>
                setForm({ ...form, stockQuantity: sanitizeIntDraft(e.target.value) })
              }
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Ngày dự kiến"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.plannedDate}
                onChange={(e) => setForm({ ...form, plannedDate: e.target.value })}
                fullWidth
              />
              <TextField
                label="Ngày hoàn thành"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.completedDate}
                onChange={(e) => setForm({ ...form, completedDate: e.target.value })}
                fullWidth
                helperText={form.status === 'PRINTED' ? 'Bắt buộc khi Đã in' : ' '}
              />
            </Stack>
            <TextField
              label="Mô tả"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              minRows={3}
              fullWidth
            />
            <MediaUploadField
              purpose="cover"
              label="Ảnh bìa"
              mediaId={form.coverMediaId}
              previewUrl={form.coverUrl}
              onChange={(coverMediaId, coverUrl) =>
                setForm({ ...form, coverMediaId, coverUrl })
              }
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
              <Typography color="error">Không lưu được. Kiểm tra dữ liệu bắt buộc.</Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button
            variant="contained"
            disabled={saveMutation.isPending || !form.name.trim()}
            onClick={() => saveMutation.mutate()}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Xóa sản phẩm?</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Đưa vào Thùng rác (có thể khôi phục). Khác với «Ẩn khỏi Public».
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
            Xóa vào thùng rác
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onClose={() => setArchiveTarget(null)}>
        <DialogTitle>Ẩn khỏi trang công khai?</DialogTitle>
        <DialogContent>
          <Typography mb={1}>
            Sản phẩm <strong>{archiveTarget?.name}</strong> sẽ:
          </Typography>
          <Typography component="ul" sx={{ pl: 2, m: 0 }}>
            <li>Không còn hiện trên website Public</li>
            <li>Vẫn còn trong Admin (không mất dữ liệu)</li>
            <li>Có thể bấm «Hiện lại Public» bất cứ lúc nào</li>
          </Typography>
          <Typography mt={2} color="text.secondary" variant="body2">
            Đây không phải Xóa. Xóa mới đưa vào thùng rác.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveTarget(null)}>Không ẩn</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={archiveMutation.isPending}
            onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
          >
            Xác nhận ẩn khỏi Public
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(unarchiveTarget)} onClose={() => setUnarchiveTarget(null)}>
        <DialogTitle>Hiện lại trên Public?</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Chọn trạng thái hiển thị cho <strong>{unarchiveTarget?.name}</strong>:
          </Typography>
          <TextField
            select
            label="Trạng thái sau khi hiện lại"
            value={unarchiveStatus}
            onChange={(e) =>
              setUnarchiveStatus(e.target.value as 'UPCOMING' | 'PRINTED')
            }
            fullWidth
          >
            <MenuItem value="UPCOMING">Sách sắp in / sắp thực hiện</MenuItem>
            <MenuItem value="PRINTED">Sách đã in / đã hoàn thành</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnarchiveTarget(null)}>Hủy</Button>
          <Button
            color="success"
            variant="contained"
            disabled={unarchiveMutation.isPending}
            onClick={() => unarchiveMutation.mutate()}
          >
            Hiện lại Public
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
