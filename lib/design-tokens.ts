/**
 * Design Tokens for Vitarak FMCG Platform
 * Strict color tokens, typography rules, touch target standards, and responsive breakpoints
 */

export const DESIGN_TOKENS = {
  colors: {
    primary: '#17307A',     // Deep Navy: Trust, brand header, primary navigation
    accent: '#F58220',      // FMCG Orange: Main actions, CTA buttons, scheme & new-item badges
    success: '#2E9E48',     // Green: In-stock, paid, confirmed status
    warning: '#D97706',     // Amber: Low stock, cutoff approaching, credit warning
    danger: '#DC2626',      // Red: STRICTLY ONLY for overdue, out of stock, and credit hold
    background: '#F8FAFC',  // Light slate background
    surface: '#FFFFFF',     // Clean white cards & containers
    text: '#0F172A',        // High contrast dark text (AA compliant)
    muted: '#64748B',       // Secondary labels, timestamps, pack descriptions
  },
  typography: {
    bodyMin: '16px',        // Minimum 16px to prevent iOS zoom & ensure legibility for shopkeepers
    headingSm: '18px',
    headingMd: '22px',
    headingLg: '28px',
  },
  touch: {
    minTargetSize: '48px',  // 48px minimum touch targets for all interactive buttons
  },
  breakpoints: {
    xs: '360px',            // Small phone (budget Android)
    sm: '480px',            // Larger mobile
    md: '768px',            // Tablet / iPad
    lg: '1024px',           // Small desktop / Tablet landscape
    xl: '1366px',           // Common Indian retail / distributor laptop
    '2xl': '1920px',        // Full HD desktop monitors
  },
} as const;
