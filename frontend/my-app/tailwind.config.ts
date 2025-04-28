import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'tech-card': '#162447', // Slightly lighter card background
        'tech-primary': '#1f4068', // Primary color (darker blue)
        'tech-accent': '#00f5ff', // Accent color (bright cyan)
        'tech-text': '#e0fbfc', // Main text color (light cyan/white)
        'tech-text-secondary': '#9fa8da', // Secondary text color (light blue/gray)
        'tech-error': '#ff4d4d', // Error color (red)
        'tech-success': '#64FFDA', // Success color (similar to accent)
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
export default config