import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { adminApi, adminGet, adminMutate } from '@/services/adminApi';

type Purpose = 'cover' | 'proof' | 'invoice';

type UploadUrlResponse = {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  provider: 'supabase' | 'local';
  media: {
    id: string;
    publicUrl: string | null;
    isPublic: boolean;
  };
};

type Props = {
  purpose: Purpose;
  label: string;
  mediaId: string | null;
  /** Public cover URL if known; private docs leave null and preview loads via access-url. */
  previewUrl?: string | null;
  onChange: (mediaId: string | null, previewUrl: string | null) => void;
  disabled?: boolean;
};

export function MediaUploadField({
  purpose,
  label,
  mediaId,
  previewUrl,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(previewUrl ?? null);

  useEffect(() => {
    setLocalPreview(previewUrl ?? null);
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadPrivatePreview() {
      if (!mediaId || previewUrl || purpose === 'cover') return;
      try {
        const { data } = await adminGet<{ url: string }>(
          `/api/admin/media/${mediaId}/access-url`,
        );
        if (!cancelled) setLocalPreview(data.url);
      } catch {
        // ignore preview failure
      }
    }
    void loadPrivatePreview();
    return () => {
      cancelled = true;
    };
  }, [mediaId, previewUrl, purpose]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const signed = await adminMutate<UploadUrlResponse>(
        'post',
        '/api/admin/media/upload-url',
        {
          purpose,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        },
      );

      const putHeaders: Record<string, string> = {
        ...(signed.headers || {}),
        'Content-Type': file.type || 'application/octet-stream',
      };

      // Local upload goes through same-origin proxy; Supabase is absolute URL.
      const isAbsolute = /^https?:\/\//i.test(signed.uploadUrl);
      if (isAbsolute && signed.provider === 'local') {
        const path = new URL(signed.uploadUrl).pathname;
        await adminApi.put(path, file, { headers: putHeaders, timeout: 60_000 });
      } else if (isAbsolute) {
        const res = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: putHeaders,
          body: file,
        });
        if (!res.ok) {
          throw new Error('Upload lên Storage thất bại');
        }
      } else {
        await adminApi.put(signed.uploadUrl, file, {
          headers: putHeaders,
          timeout: 60_000,
        });
      }

      const confirmed = await adminMutate<{
        id: string;
        publicUrl: string | null;
      }>('post', `/api/admin/media/${signed.mediaId}/confirm`, {
        fileSize: file.size,
      });

      const objectUrl = URL.createObjectURL(file);
      const nextPreview = confirmed.publicUrl || objectUrl;
      setLocalPreview(nextPreview);
      onChange(confirmed.id, confirmed.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không upload được ảnh');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{label}</Typography>
      {localPreview ? (
        <Box
          component="img"
          src={localPreview}
          alt={label}
          sx={{
            width: '100%',
            maxHeight: 180,
            objectFit: 'contain',
            bgcolor: 'rgba(31,77,58,0.06)',
            borderRadius: 1,
          }}
        />
      ) : null}
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Đang tải…' : mediaId ? 'Thay ảnh' : 'Chọn ảnh'}
        </Button>
        {mediaId ? (
          <Button
            size="small"
            color="inherit"
            disabled={disabled || busy}
            onClick={() => {
              setLocalPreview(null);
              onChange(null, null);
            }}
          >
            Gỡ
          </Button>
        ) : null}
      </Stack>
      <input
        ref={inputRef}
        type="file"
        accept={
          purpose === 'cover'
            ? 'image/jpeg,image/png,image/webp,image/gif'
            : 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
        }
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
      {error ? (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
}
