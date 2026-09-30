import { Box, CircularProgress, Stack, Typography } from '@mui/material';

type Props = {
  label?: string;
  minHeight?: number | string;
};

export function LoadingState({ label = 'Đang tải...', minHeight = 240 }: Props) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight, py: 4 }}>
      <CircularProgress size={36} thickness={4} />
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
    </Stack>
  );
}

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Box
      sx={{
        py: 6,
        px: 2,
        textAlign: 'center',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'rgba(255,255,255,0.55)',
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {description ? (
        <Typography color="text.secondary" variant="body2">
          {description}
        </Typography>
      ) : null}
    </Box>
  );
}

export function ErrorState({
  message = 'Không tải được dữ liệu. Vui lòng thử lại sau.',
}: {
  message?: string;
}) {
  return (
    <Box
      sx={{
        py: 4,
        px: 2,
        textAlign: 'center',
        borderRadius: 3,
        bgcolor: 'rgba(180, 50, 50, 0.06)',
        border: '1px solid rgba(180, 50, 50, 0.18)',
      }}
    >
      <Typography color="error.dark" variant="body1">
        {message}
      </Typography>
    </Box>
  );
}
