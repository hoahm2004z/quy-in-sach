import {
  Box,
  Breadcrumbs,
  Chip,
  Container,
  Divider,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { fetchProductById } from '@/services/publicApi';
import { ProductCover } from '@/components/ProductCover';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import {
  formatDate,
  formatVnd,
  productStatusLabel,
  productTypeLabel,
} from '@/utils/format';

export function ProductDetailPage() {
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['public', 'products', id],
    queryFn: () => fetchProductById(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <Container maxWidth="lg">
        <LoadingState minHeight={360} />
      </Container>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Container maxWidth="lg">
        <ErrorState message="Không tìm thấy sản phẩm hoặc đã bị ẩn." />
      </Container>
    );
  }

  const product = query.data;
  const isUpcoming = product.status === 'UPCOMING';

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Breadcrumbs>
          <MuiLink component={RouterLink} to="/" underline="hover" color="inherit">
            Trang chủ
          </MuiLink>
          <MuiLink
            component={RouterLink}
            to="/products"
            underline="hover"
            color="inherit"
          >
            Sách & Loa
          </MuiLink>
          <Typography color="text.primary">{product.name}</Typography>
        </Breadcrumbs>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
            alignItems: 'start',
          }}
        >
          <Box
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <ProductCover
              alt={product.name}
              productType={product.productType}
              src={product.coverUrl}
              variant="detail"
            />
          </Box>

          <Stack spacing={2}>
            <Chip
              label={productStatusLabel(product.productType, product.status)}
              sx={{
                alignSelf: 'flex-start',
                bgcolor: 'rgba(31,77,58,0.08)',
                color: 'primary.dark',
                fontWeight: 600,
              }}
            />
            <Typography
              component="h1"
              variant="h3"
              sx={{ fontSize: { xs: '1.75rem', md: '2.35rem' } }}
            >
              {product.name}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <InfoTile label="Loại" value={productTypeLabel(product.productType)} />
              <InfoTile
                label={isUpcoming ? 'Dự toán' : 'Chi phí thực tế'}
                value={formatVnd(isUpcoming ? product.budgetEstimate : product.actualCost)}
                emphasize
              />
              <InfoTile
                label="Số lượng dự kiến"
                value={product.plannedQuantity.toLocaleString('vi-VN')}
              />
              <InfoTile
                label="Số lượng đã in"
                value={product.printedQuantity.toLocaleString('vi-VN')}
              />
              <InfoTile
                label="Tồn kho"
                value={product.stockQuantity.toLocaleString('vi-VN')}
              />
              <InfoTile
                label="Ngày dự kiến"
                value={formatDate(product.plannedDate)}
              />
              <InfoTile
                label="Ngày hoàn thành"
                value={formatDate(product.completedDate)}
              />
              {!isUpcoming ? (
                <InfoTile
                  label="Dự toán ban đầu"
                  value={formatVnd(product.budgetEstimate)}
                />
              ) : null}
            </Box>

            {product.description ? (
              <Box>
                <Typography variant="h6" mb={1}>
                  Mô tả
                </Typography>
                <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {product.description}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        </Box>

        <Divider />

        <Box component="section">
          <Typography variant="h5" mb={2}>
            Khoản chi liên quan
          </Typography>
          {product.relatedExpenses.length === 0 ? (
            <EmptyState
              title="Chưa có khoản chi công khai"
              description="Các khoản chi liên quan sẽ hiện khi được xác nhận và cho phép công khai."
            />
          ) : (
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                overflow: 'auto',
                bgcolor: 'background.paper',
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ngày</TableCell>
                    <TableCell>Nội dung</TableCell>
                    <TableCell>Danh mục</TableCell>
                    <TableCell align="right">Số tiền</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {product.relatedExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.expenseDate)}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell align="right">{formatVnd(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      </Stack>
    </Container>
  );
}

function InfoTile({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body1"
        fontWeight={emphasize ? 700 : 600}
        sx={{ mt: 0.25 }}
      >
        {value}
      </Typography>
    </Box>
  );
}
