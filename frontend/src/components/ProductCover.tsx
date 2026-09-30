import { Box } from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SpeakerRoundedIcon from '@mui/icons-material/SpeakerRounded';
import { useState, type MouseEvent } from 'react';
import { ImageLightbox } from '@/components/ImageLightbox';

type Props = {
  alt: string;
  productType: 'BOOK' | 'SPEAKER' | string;
  src?: string | null;
  /** card = grid cards; detail = product detail hero frame */
  variant?: 'card' | 'detail';
  /** Double-click opens lightbox when src exists. Default true. */
  enableLightbox?: boolean;
};

const FRAME_HEIGHT = {
  card: { xs: 180, sm: 200, md: 220 },
  detail: { xs: 260, sm: 320, md: 380 },
} as const;

/**
 * Fixed frame, uniform card height.
 * Image uses object-fit: contain — full image visible, no crop/stretch.
 * Double-click opens ImageLightbox (view only).
 */
export function ProductCover({
  alt,
  productType,
  src,
  variant = 'card',
  enableLightbox = true,
}: Props) {
  const frameHeight = FRAME_HEIGHT[variant];
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const canLightbox = Boolean(enableLightbox && src);

  function handleDoubleClick(e: MouseEvent) {
    if (!canLightbox) return;
    e.preventDefault();
    e.stopPropagation();
    setLightboxOpen(true);
  }

  return (
    <>
      <Box
        onDoubleClick={handleDoubleClick}
        sx={{
          width: '100%',
          height: frameHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          bgcolor: 'rgba(31, 77, 58, 0.08)',
          backgroundImage:
            'linear-gradient(145deg, rgba(31,77,58,0.12) 0%, rgba(139,107,63,0.10) 100%)',
          cursor: canLightbox ? 'zoom-in' : 'default',
        }}
      >
        {src ? (
          <Box
            component="img"
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            sx={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <Box
            sx={{
              color: 'primary.main',
              opacity: 0.55,
              display: 'grid',
              placeItems: 'center',
            }}
            aria-label={alt}
            role="img"
          >
            {productType === 'SPEAKER' ? (
              <SpeakerRoundedIcon sx={{ fontSize: 48 }} />
            ) : (
              <MenuBookRoundedIcon sx={{ fontSize: 48 }} />
            )}
          </Box>
        )}
      </Box>

      {src ? (
        <ImageLightbox
          open={lightboxOpen}
          src={src}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}
