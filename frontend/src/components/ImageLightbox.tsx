import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Typography,
} from '@mui/material';
import { useState } from 'react';

type Props = {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
};

/**
 * Full-viewport image viewer. object-fit: contain — no crop, no stretch.
 * Close: X button, backdrop click, Escape.
 */
export function ImageLightbox({ open, src, alt, onClose }: Props) {
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const status =
    failedFor === src ? 'error' : loadedFor === src ? 'ready' : 'loading';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          },
        },
      }}
      PaperProps={{
        elevation: 0,
        sx: {
          bgcolor: 'transparent',
          boxShadow: 'none',
          m: 0,
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
        },
      }}
      aria-label={`Xem ảnh: ${alt}`}
    >
      <IconButton
        aria-label="Đóng ảnh"
        onClick={onClose}
        sx={{
          position: 'fixed',
          top: { xs: 8, sm: 16 },
          right: { xs: 8, sm: 16 },
          zIndex: 2,
          color: '#fff',
          bgcolor: 'rgba(0,0,0,0.45)',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
        }}
      >
        <CloseRoundedIcon />
      </IconButton>

      <Box
        onClick={onClose}
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 1.5, sm: 3 },
          boxSizing: 'border-box',
          cursor: 'zoom-out',
        }}
      >
        {status === 'loading' ? (
          <CircularProgress sx={{ color: '#fff' }} aria-label="Đang tải ảnh" />
        ) : null}

        {status === 'error' ? (
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.85)',
              px: 2,
            }}
          >
            <BrokenImageOutlinedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.7 }} />
            <Typography>Không tải được ảnh</Typography>
          </Box>
        ) : null}

        {open && src ? (
          <Box
            key={src}
            component="img"
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setLoadedFor(src)}
            onError={() => setFailedFor(src)}
            sx={{
              display: status === 'ready' ? 'block' : 'none',
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              objectPosition: 'center',
              userSelect: 'none',
              cursor: 'default',
            }}
          />
        ) : null}
      </Box>
    </Dialog>
  );
}
