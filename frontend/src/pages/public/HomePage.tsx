import type { ReactNode } from 'react';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { fetchCompanions, fetchProducts, fetchStatistics } from '@/services/publicApi';
import { FundStatsStrip } from '@/features/transparency/FundStatsStrip';
import { ProductCard } from '@/features/products/ProductCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateBlocks';
import type { PublicProduct } from '@/types/public';

export function HomePage() {
  const statsQuery = useQuery({
    queryKey: ['public', 'statistics'],
    queryFn: fetchStatistics,
  });

  const upcomingQuery = useQuery({
    queryKey: ['public', 'products', 'home', 'upcoming'],
    queryFn: () =>
      fetchProducts({ type: 'BOOK', status: 'UPCOMING', pageSize: 3 }),
  });

  const printedQuery = useQuery({
    queryKey: ['public', 'products', 'home', 'printed'],
    queryFn: () =>
      fetchProducts({ type: 'BOOK', status: 'PRINTED', pageSize: 3 }),
  });

  const speakersQuery = useQuery({
    queryKey: ['public', 'products', 'home', 'speakers'],
    queryFn: () => fetchProducts({ type: 'SPEAKER', pageSize: 3 }),
  });

  const companionsQuery = useQuery({
    queryKey: ['public', 'companions'],
    queryFn: fetchCompanions,
  });

  return (
    <Container maxWidth="lg">
      <Stack spacing={{ xs: 5, md: 7 }}>
        {/* Hero — brand first */}
        <Box
          sx={{
            position: 'relative',
            borderRadius: { xs: 3, md: 4 },
            overflow: 'hidden',
            px: { xs: 2.5, md: 6 },
            py: { xs: 5, md: 8 },
            color: 'primary.contrastText',
            background:
              'linear-gradient(135deg, #143528 0%, #1F4D3A 45%, #3A7A5C 100%)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.18,
              backgroundImage:
                'radial-gradient(circle at 80% 20%, #fff 0%, transparent 40%), radial-gradient(circle at 10% 90%, #8B6B3F 0%, transparent 35%)',
              pointerEvents: 'none',
            }}
          />
          <Stack spacing={2} sx={{ position: 'relative', maxWidth: 720 }}>
            <Typography
              component="p"
              variant="overline"
              sx={{ letterSpacing: '0.14em', opacity: 0.9 }}
            >
              Minh bạch · Lan tỏa · Phụng sự
            </Typography>
            <Typography
              component="h1"
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                lineHeight: 1.15,
              }}
            >
              Quỹ in sách đạo đức cho mọi người
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 560 }}>
              Theo dõi sách đang in, sách đã phát hành, loa pháp thoại và toàn bộ
              thu – chi được công khai.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} pt={1}>
              <Button
                component={RouterLink}
                to="/products"
                variant="contained"
                color="secondary"
                size="large"
              >
                Xem sách & loa
              </Button>
              <Button
                component={RouterLink}
                to="/transparency"
                variant="outlined"
                size="large"
                sx={{
                  borderColor: 'rgba(255,255,255,0.55)',
                  color: 'inherit',
                  '&:hover': {
                    borderColor: '#fff',
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                Minh bạch thu – chi
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Section title="Tình hình quỹ">
          {statsQuery.isLoading ? <LoadingState /> : null}
          {statsQuery.isError ? <ErrorState /> : null}
          {statsQuery.data ? <FundStatsStrip stats={statsQuery.data} /> : null}
        </Section>

        <ProductSection
          title="Sách sắp in"
          query={upcomingQuery}
          seeAllTo="/products?filter=BOOK_UPCOMING"
        />
        <ProductSection
          title="Sách đã in"
          query={printedQuery}
          seeAllTo="/products?filter=BOOK_PRINTED"
        />
        <ProductSection
          title="Loa pháp thoại"
          query={speakersQuery}
          seeAllTo="/products?filter=SPEAKER"
        />

        <Section
          title="Người đồng hành"
          action={
            <Button component={RouterLink} to="/transparency" variant="text">
              Xem minh bạch
            </Button>
          }
        >
          {companionsQuery.isLoading ? <LoadingState minHeight={120} /> : null}
          {companionsQuery.isError ? <ErrorState /> : null}
          {companionsQuery.data && companionsQuery.data.length === 0 ? (
            <EmptyState title="Chưa có người đồng hành được công khai" />
          ) : null}
          {companionsQuery.data && companionsQuery.data.length > 0 ? (
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: '1fr 1fr 1fr',
                },
              }}
            >
              {companionsQuery.data.map((c) => (
                <Box
                  key={c.id}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography fontWeight={700}>{c.displayName}</Typography>
                  {c.note ? (
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {c.note}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Box>
          ) : null}
        </Section>
      </Stack>
    </Container>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box component="section">
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={2.5}
        gap={2}
      >
        <Typography
          component="h2"
          variant="h4"
          sx={{ fontSize: { xs: '1.5rem', md: '1.85rem' } }}
        >
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

function ProductSection({
  title,
  query,
  seeAllTo,
}: {
  title: string;
  seeAllTo: string;
  query: {
    isLoading: boolean;
    isError: boolean;
    data?: { data: PublicProduct[] };
  };
}) {
  return (
    <Section
      title={title}
      action={
        <Button component={RouterLink} to={seeAllTo} variant="text">
          Xem tất cả
        </Button>
      }
    >
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState title={`Chưa có ${title.toLowerCase()}`} />
      ) : null}
      {query.data && query.data.data.length > 0 ? (
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
          {query.data.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Box>
      ) : null}
    </Section>
  );
}
