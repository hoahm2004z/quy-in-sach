import { useMemo, useState } from 'react';
import {
  Box,
  Container,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchProducts } from '@/services/publicApi';
import { ProductFilterBar } from '@/features/products/ProductFilterBar';
import { filterToQuery } from '@/features/products/productFilters';
import { ProductCard } from '@/features/products/ProductCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import type { ProductFilterKey } from '@/types/public';

const VALID_FILTERS: ProductFilterKey[] = [
  'ALL',
  'BOOK_UPCOMING',
  'BOOK_PRINTED',
  'SPEAKER',
];

function parseFilter(raw: string | null): ProductFilterKey {
  if (raw && VALID_FILTERS.includes(raw as ProductFilterKey)) {
    return raw as ProductFilterKey;
  }
  return 'ALL';
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams.get('filter'));
  const [page, setPage] = useState(1);
  const queryParams = useMemo(() => filterToQuery(filter), [filter]);

  const productsQuery = useQuery({
    queryKey: ['public', 'products', filter, page],
    queryFn: () =>
      fetchProducts({
        ...queryParams,
        page,
        pageSize: 12,
      }),
  });

  const totalPages = productsQuery.data?.meta?.totalPages ?? 1;

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Box>
          <Typography
            component="h1"
            variant="h3"
            sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 1 }}
          >
            Sách & Loa
          </Typography>
          <Typography color="text.secondary">
            Tra cứu sách sắp in, sách đã in và loa pháp thoại.
          </Typography>
        </Box>

        <ProductFilterBar
          value={filter}
          onChange={(next) => {
            setPage(1);
            setSearchParams(next === 'ALL' ? {} : { filter: next });
          }}
        />

        {productsQuery.isLoading ? <LoadingState /> : null}
        {productsQuery.isError ? <ErrorState /> : null}
        {productsQuery.data && productsQuery.data.data.length === 0 ? (
          <EmptyState
            title="Không có sản phẩm phù hợp"
            description="Thử chọn bộ lọc khác hoặc quay lại sau."
          />
        ) : null}

        {productsQuery.data && productsQuery.data.data.length > 0 ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: '1fr 1fr 1fr',
                },
              }}
            >
              {productsQuery.data.data.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </Box>

            {totalPages > 1 ? (
              <Stack alignItems="center" pt={1}>
                <Pagination
                  page={page}
                  count={totalPages}
                  color="primary"
                  onChange={(_e, value) => setPage(value)}
                />
              </Stack>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Container>
  );
}
