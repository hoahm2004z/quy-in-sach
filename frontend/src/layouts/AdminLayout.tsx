import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAdminAuth } from '@/features/auth/AdminAuthContext';
import { LoadingState } from '@/components/StateBlocks';

const DRAWER_WIDTH = 260;

const MENU = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/products', label: 'Sách & Loa' },
  { to: '/admin/donations', label: 'Khoản thu' },
  { to: '/admin/expenses', label: 'Khoản chi' },
  { to: '/admin/companions', label: 'Người đồng hành' },
  { to: '/admin/audit-logs', label: 'Nhật ký' },
  { to: '/admin/trash', label: 'Thùng rác' },
];

export function AdminLayout() {
  const { user, loading, logout } = useAdminAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);

  if (loading) return <LoadingState minHeight="70vh" />;
  if (!user) return <Navigate to="/admin/login" replace />;

  const nav = (
    <Box sx={{ py: 2 }}>
      <Typography px={2} mb={1} fontWeight={700} color="primary.main">
        Quỹ In Sách
      </Typography>
      <Typography px={2} mb={2} variant="caption" color="text.secondary">
        {user.fullName}
      </Typography>
      <List>
        {MENU.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            sx={{
              mx: 1,
              borderRadius: 2,
              '&.active': {
                bgcolor: 'rgba(31,77,58,0.1)',
                color: 'primary.main',
                fontWeight: 700,
              },
            }}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F3F6F2' }}>
      {!isMobile ? (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {nav}
        </Drawer>
      ) : (
        <Drawer open={open} onClose={() => setOpen(false)}>
          <Box sx={{ width: DRAWER_WIDTH }}>{nav}</Box>
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Toolbar>
            {isMobile ? (
              <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Mở menu">
                <MenuRoundedIcon />
              </IconButton>
            ) : null}
            <Typography sx={{ flex: 1 }} fontWeight={600}>
              Khu vực quản trị
            </Typography>
            <Button onClick={logout} color="inherit">
              Đăng xuất
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
