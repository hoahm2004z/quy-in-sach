import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/features/auth/AdminAuthContext';
import { LoadingState } from '@/components/StateBlocks';

export function AdminLoginPage() {
  const { user, loading, login, usesSupabaseAuth } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingState minHeight="70vh" />;
  if (user) return <Navigate to="/admin" replace />;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        background:
          'radial-gradient(ellipse at top, rgba(58,122,92,0.12), transparent 50%), #F3F6F2',
      }}
    >
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <Stack
            spacing={2.5}
            component="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              setError(null);
              try {
                await login(email, password);
                navigate('/admin', { replace: true });
              } catch {
                setError(
                  'Đăng nhập thất bại. Kiểm tra thư điện tử/mật khẩu hoặc cấu hình máy chủ.',
                );
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Box>
              <Typography variant="h4" sx={{ fontFamily: '"Literata", serif' }}>
                Quản trị quỹ
              </Typography>
              <Typography color="text.secondary" mt={0.5}>
                Đăng nhập để quản lý sách, thu – chi và minh bạch.
              </Typography>
            </Box>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Thư điện tử"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {usesSupabaseAuth
                ? 'Đăng nhập qua Supabase Auth. Tài khoản phải được cấp quyền ADMIN trong hệ thống.'
                : 'Môi trường phát triển: dùng tài khoản mẫu (dev-login). Production sẽ dùng Supabase Auth.'}
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
