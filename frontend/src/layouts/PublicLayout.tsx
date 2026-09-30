import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Link as RouterLink, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

const NAV = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/products', label: 'Sách & Loa' },
  { to: '/transparency', label: 'Minh bạch' },
];

export function PublicLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          backdropFilter: 'blur(10px)',
          bgcolor: 'rgba(247, 250, 246, 0.86)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ py: 1, gap: 2 }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                flex: 1,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Literata", serif',
                  fontWeight: 700,
                  color: 'primary.main',
                  lineHeight: 1.2,
                }}
              >
                Quỹ in sách chia sẻ đạo đức cho mọi người
              </Typography>
            </Box>

            {!isMobile ? (
              <Stack direction="row" spacing={1} alignItems="center">
                {NAV.map((item) => (
                  <Button
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    end={item.end}
                    sx={{
                      color: 'text.primary',
                      '&.active': {
                        color: 'primary.main',
                        bgcolor: 'rgba(31,77,58,0.08)',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Stack>
            ) : (
              <IconButton
                aria-label="Mở menu"
                onClick={() => setOpen(true)}
                edge="end"
              >
                <MenuRoundedIcon />
              </IconButton>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 280, p: 2 }} role="presentation">
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography fontWeight={700}>Danh mục</Typography>
            <IconButton aria-label="Đóng menu" onClick={() => setOpen(false)}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          <List>
            {NAV.map((item) => (
              <ListItemButton
                key={item.to}
                component={RouterLink}
                to={item.to}
                selected={
                  item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to)
                }
                onClick={() => setOpen(false)}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, py: { xs: 3, md: 5 } }}>
        <Outlet />
      </Box>

      <Box
        component="footer"
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          py: 3,
          mt: 'auto',
          bgcolor: 'rgba(255,255,255,0.55)',
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Quỹ in sách chia sẻ đạo đức cho mọi người
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
