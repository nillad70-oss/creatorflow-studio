/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // NillaFlowDesign System
        void: '#080A0E',
        graphite: '#111318',
        surface: '#161B24',
        border: '#1E2530',
        muted: '#2A3140',
        subtle: '#3D4D63',
        // Text
        primary: '#F0F2F5',
        secondary: '#8A97A8',
        tertiary: '#4A5568',
        // Accent
        electric: '#3B82F6',
        'electric-dim': '#1D4ED8',
        'electric-glow': '#60A5FA',
        gold: '#D4A853',
        'gold-dim': '#B8923F',
        // Status
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'electric-glow': 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.15) 0%, transparent 70%)',
        'gold-glow': 'radial-gradient(ellipse at 50% 100%, rgba(212,168,83,0.08) 0%, transparent 60%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'scroll-hint': 'scrollHint 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59,130,246,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(59,130,246,0.6)' },
        },
        scrollHint: {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
          '50%': { transform: 'translateY(6px)', opacity: '1' },
        },
      },
      boxShadow: {
        'electric': '0 0 30px rgba(59,130,246,0.2)',
        'electric-lg': '0 0 60px rgba(59,130,246,0.3)',
        'gold': '0 0 30px rgba(212,168,83,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
