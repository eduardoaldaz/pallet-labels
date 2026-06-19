import { createTheme } from '@mui/material/styles';

export const businessCentralTheme = createTheme({
  palette: {
    primary: {
      main: '#00686F',        // Color exacto de los números de pedido e iconos
      light: '#4C9FD8',
      dark: '#005A9E',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#2c2c2c',        // Barra superior oscura
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
    success: {
      main: '#107c10',
    },
    error: {
      main: '#d13438',        // Rojo para el icono de PDF
    },
    warning: {
      main: '#f2a400',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", sans-serif',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#2c2c2c',
          color: '#ffffff',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#f2f2f2',
          '& .MuiTableCell-head': {
            fontWeight: 600,
            color: '#212121',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            borderBottom: '2px solid #d0d0d0',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #e0e0e0',
          color: '#212121',
          padding: '8px 12px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: 'none',
          border: '1px solid #e0e0e0',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#f0f0f0',
          color: '#212121',
        },
        colorPrimary: {
          backgroundColor: '#e6e8ea',
          color: '#00686F',
        },
        colorSuccess: {
          backgroundColor: '#e6f3e6',
          color: '#107c10',
        },
        colorWarning: {
          backgroundColor: '#fff4cc',
          color: '#9f9700',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: '#00686F',
          '&:hover': {
            backgroundColor: '#005A5E',
          },
        },
        outlined: {
          borderColor: '#00686F',
          color: '#00686F',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#00686F',
        },
        colorPrimary: {
          color: '#00686F',
        },
        colorError: {
          color: '#d13438',    // Para el botón de PDF en rojo
        },
      },
    },
  },
});