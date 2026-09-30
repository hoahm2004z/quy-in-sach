import { Box, Stack, Typography } from '@mui/material';
import { formatVnd } from '@/utils/format';
import type { FundStatistics } from '@/types/public';

type Props = {
  stats: FundStatistics;
  compact?: boolean;
};

const ITEMS: Array<{
  key: keyof FundStatistics;
  label: string;
  emphasize?: boolean;
}> = [
  { key: 'balance', label: 'Số dư quỹ', emphasize: true },
  { key: 'totalIncome', label: 'Tổng thu' },
  { key: 'totalExpense', label: 'Tổng chi' },
  { key: 'upcomingBudget', label: 'Dự toán sắp thực hiện' },
];

export function FundStatsStrip({ stats, compact }: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          md: 'repeat(4, 1fr)',
        },
      }}
    >
      {ITEMS.map((item) => (
        <Box
          key={item.key}
          sx={{
            p: compact ? 2 : 2.5,
            height: '100%',
            borderRadius: 3,
            bgcolor: item.emphasize ? 'primary.main' : 'background.paper',
            color: item.emphasize ? 'primary.contrastText' : 'text.primary',
            border: item.emphasize ? 'none' : '1px solid',
            borderColor: 'divider',
            boxShadow: item.emphasize
              ? '0 10px 30px rgba(31, 77, 58, 0.22)'
              : 'none',
          }}
        >
          <Stack spacing={0.75}>
            <Typography
              variant="body2"
              sx={{
                opacity: item.emphasize ? 0.85 : 1,
                color: item.emphasize ? 'inherit' : 'text.secondary',
              }}
            >
              {item.label}
            </Typography>
            <Typography
              variant={compact ? 'h6' : 'h5'}
              sx={{
                fontFamily: '"Literata", serif',
                fontWeight: 650,
                letterSpacing: '-0.01em',
              }}
            >
              {formatVnd(stats[item.key])}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
