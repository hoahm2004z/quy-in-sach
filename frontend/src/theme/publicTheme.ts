import { createTheme } from '@mui/material/styles';

/**
 * Public site theme — clean, solemn, readable.
 * Soft sage + deep ink (not purple, not cream/terracotta, not newspaper).
 */
export const publicTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1F4D3A',
      light: '#3A7A5C',
      dark: '#143528',
      contrastText: '#F7FBF8',
    },
    secondary: {
      main: '#8B6B3F',
      contrastText: '#FFFDF8',
    },
    background: {
      default: '#F3F6F2',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A2420',
      secondary: '#4A5A52',
    },
    divider: 'rgba(31, 77, 58, 0.12)',
  },
  typography: {
    fontFamily: '"Be Vietnam Pro", "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"Literata", "Times New Roman", serif',
      fontWeight: 650,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: '"Literata", "Times New Roman", serif',
      fontWeight: 650,
    },
    h3: {
      fontFamily: '"Literata", "Times New Roman", serif',
      fontWeight: 600,
    },
    h4: {
      fontFamily: '"Literata", "Times New Roman", serif',
      fontWeight: 600,
    },
    h5: {
      fontFamily: '"Literata", "Times New Roman", serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingLeft: 20,
          paddingRight: 20,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(ellipse at top, rgba(58, 122, 92, 0.08), transparent 55%), linear-gradient(180deg, #F7FAF6 0%, #F3F6F2 40%, #EEF2EC 100%)',
          minHeight: '100vh',
        },
        a: {
          color: 'inherit',
          textDecoration: 'none',
        },
      },
    },
  },
});
