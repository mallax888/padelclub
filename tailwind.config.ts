import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base:    '#18181B',
        surface: '#27272A',
        raised:  '#3F3F46',
        cyan: {
          lumo:  '#4DFFEE',
          deep:  '#00A896',
          dark:  '#006B60',
          muted: '#4DFFEE1A',
        },
        pink: {
          lumo:  '#FF2D78',
          deep:  '#C4005A',
          muted: '#FF2D781A',
        },
        ink: {
          primary: '#F4F4F5',
          muted:   '#A1A1AA',
          subtle:  '#71717A',
        },
        stone: {
          50:  '#FFFFFF',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        glow:       '0 0 16px 0 #4DFFEE33',
        'glow-pink':'0 0 16px 0 #FF2D7833',
        'glow-sm':  '0 0 8px 0 #4DFFEE22',
      },
    },
  },
  plugins: [],
}
export default config
