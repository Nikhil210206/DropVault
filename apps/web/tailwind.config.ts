import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const withAlpha = (v: string) => `hsl(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        border: withAlpha('--border'),
        input: withAlpha('--input'),
        ring: withAlpha('--ring'),
        background: withAlpha('--background'),
        foreground: withAlpha('--foreground'),
        primary: { DEFAULT: withAlpha('--primary'), foreground: withAlpha('--primary-foreground') },
        secondary: { DEFAULT: withAlpha('--secondary'), foreground: withAlpha('--secondary-foreground') },
        destructive: { DEFAULT: withAlpha('--destructive'), foreground: withAlpha('--destructive-foreground') },
        muted: { DEFAULT: withAlpha('--muted'), foreground: withAlpha('--muted-foreground') },
        accent: { DEFAULT: withAlpha('--accent'), foreground: withAlpha('--accent-foreground') },
        popover: { DEFAULT: withAlpha('--popover'), foreground: withAlpha('--popover-foreground') },
        card: { DEFAULT: withAlpha('--card'), foreground: withAlpha('--card-foreground') },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 3px)',
        sm: 'calc(var(--radius) - 5px)',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        md: '0 4px 14px -3px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.05)',
        lg: '0 16px 40px -12px rgb(0 0 0 / 0.16)',
        popover: '0 8px 28px -8px rgb(0 0 0 / 0.16)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [animate],
};

export default config;
