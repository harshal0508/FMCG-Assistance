import type { Config } from 'tailwindcss';
import { DESIGN_TOKENS } from './lib/design-tokens';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      xs: DESIGN_TOKENS.breakpoints.xs,
      sm: DESIGN_TOKENS.breakpoints.sm,
      md: DESIGN_TOKENS.breakpoints.md,
      lg: DESIGN_TOKENS.breakpoints.lg,
      xl: DESIGN_TOKENS.breakpoints.xl,
      '2xl': DESIGN_TOKENS.breakpoints['2xl'],
    },
    extend: {
      colors: {
        primary: DESIGN_TOKENS.colors.primary,
        accent: DESIGN_TOKENS.colors.accent,
        success: DESIGN_TOKENS.colors.success,
        warning: DESIGN_TOKENS.colors.warning,
        danger: DESIGN_TOKENS.colors.danger,
        background: DESIGN_TOKENS.colors.background,
        surface: DESIGN_TOKENS.colors.surface,
        'app-text': DESIGN_TOKENS.colors.text,
        'app-muted': DESIGN_TOKENS.colors.muted,
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Newsreader"', 'Lora', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        display: ['"Newsreader"', 'Lora', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
      minHeight: {
        touch: DESIGN_TOKENS.touch.minTargetSize,
      },
      minWidth: {
        touch: DESIGN_TOKENS.touch.minTargetSize,
      },
      fontSize: {
        body: [DESIGN_TOKENS.typography.bodyMin, { lineHeight: '1.5rem' }],
      },
    },
  },
  plugins: [],
};

export default config;
