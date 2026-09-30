import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { PublicProduct } from '@/types/public';
import { ProductCover } from '@/components/ProductCover';
import {
  formatDate,
  formatVnd,
  productStatusLabel,
} from '@/utils/format';

type Props = {
  product: PublicProduct;
};

export function ProductCard({ product }: Props) {
  const isUpcoming = product.status === 'UPCOMING';
  const costLabel = isUpcoming ? 'Dự toán' : 'Chi phí thực tế';
  const costValue = isUpcoming ? product.budgetEstimate : product.actualCost;
  const dateLabel = isUpcoming ? 'Dự kiến' : 'Hoàn thành';
  const dateValue = isUpcoming ? product.plannedDate : product.completedDate;
  const qty =
    product.status === 'PRINTED' || product.productType === 'SPEAKER'
      ? product.printedQuantity
      : product.plannedQuantity;

  return (
    <Box
      component="article"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: '0 12px 28px rgba(26, 36, 32, 0.08)',
        },
      }}
    >
      <ProductCover
        alt={product.name}
        productType={product.productType}
        src={product.coverUrl}
      />

      <Stack spacing={1.25} sx={{ p: 2.25, flex: 1 }}>
        <Chip
          size="small"
          label={productStatusLabel(product.productType, product.status)}
          sx={{
            alignSelf: 'flex-start',
            bgcolor: 'rgba(31,77,58,0.08)',
            color: 'primary.dark',
            fontWeight: 600,
          }}
        />

        <Typography
          component="h3"
          variant="h6"
          sx={{
            fontFamily: '"Literata", serif',
            lineHeight: 1.35,
            minHeight: 48,
          }}
        >
          {product.name}
        </Typography>

        <Stack spacing={0.5} sx={{ color: 'text.secondary', flex: 1 }}>
          <MetaRow label={costLabel} value={formatVnd(costValue)} emphasize />
          <MetaRow label="Số lượng" value={qty.toLocaleString('vi-VN')} />
          <MetaRow
            label="Tồn kho"
            value={product.stockQuantity.toLocaleString('vi-VN')}
          />
          <MetaRow label={dateLabel} value={formatDate(dateValue)} />
        </Stack>

        <Button
          component={RouterLink}
          to={`/products/${product.id}`}
          variant="outlined"
          color="primary"
          fullWidth
          sx={{ mt: 1 }}
        >
          Xem chi tiết
        </Button>
      </Stack>
    </Box>
  );
}

function MetaRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2">{label}</Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: emphasize ? 700 : 500,
          color: emphasize ? 'text.primary' : 'inherit',
          textAlign: 'right',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
