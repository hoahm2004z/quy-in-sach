import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ProductFilterKey } from '@/types/public';

const FILTERS: Array<{ key: ProductFilterKey; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'BOOK_UPCOMING', label: 'Sách sắp in' },
  { key: 'BOOK_PRINTED', label: 'Sách đã in' },
  { key: 'SPEAKER', label: 'Loa pháp thoại' },
];

type Props = {
  value: ProductFilterKey;
  onChange: (value: ProductFilterKey) => void;
};

export function ProductFilterBar({ value, onChange }: Props) {
  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_e, next: ProductFilterKey | null) => {
        if (next) onChange(next);
      }}
      aria-label="Bộ lọc sản phẩm"
      sx={{
        flexWrap: 'wrap',
        gap: 1,
        '& .MuiToggleButtonGroup-grouped': {
          border: '1px solid',
          borderColor: 'divider !important',
          borderRadius: '999px !important',
          px: 2,
          py: 0.75,
          textTransform: 'none',
          fontWeight: 600,
          color: 'text.secondary',
          bgcolor: 'rgba(255,255,255,0.7)',
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
          },
        },
      }}
    >
      {FILTERS.map((f) => (
        <ToggleButton key={f.key} value={f.key}>
          {f.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
