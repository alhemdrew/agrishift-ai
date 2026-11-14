import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1f8f4',
          100: '#dcefe3',
          200: '#b9dfc9',
          300: '#8cc9a7',
          400: '#56ad82',
          500: '#2f8d62',
          600: '#1f7050',
          700: '#185a42',
          800: '#144836',
          900: '#0f3a2b',
          950: '#082318',
        },
        amber: {
          300: '#fcd34d',
          400: '#fbbf4f',
          500: '#f59e0b',
        },
        sky: {
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        teal: {
          500: '#14b8a6',
        },
        lime: {
          400: '#a3e635',
          600: '#65a30d',
        },
        orange: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        red: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        violet: {
          400: '#a78bfa',
        },
        fuchsia: {
          500: '#d946ef',
        },
        slate: {
          100: '#f1f5f9',
          600: '#475569',
          700: '#334155',
          900: '#0f172a',
        },
        emerald: {
          100: '#d1fae5',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          400: '#fbbf4f',
          500: '#f59e0b',
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(23, 75, 58, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
