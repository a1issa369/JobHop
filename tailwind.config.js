/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1B2D',        // deep blueprint navy — app background
        panel: '#16273D',      // raised panel surface on dark bg
        grid: '#25405F',       // gridlines / borders
        paper: '#EDF1F5',      // light surface (cards, modals)
        signal: '#F2A63A',     // amber tracer accent — the one bold color
        route: '#5B8DB8',      // muted route/line blue
        good: '#4CAF7D',
        bad: '#E2574C',
        ink2: '#9FB3C8'        // secondary text on dark
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      },
      backgroundImage: {
        blueprint:
          'linear-gradient(rgba(37,64,95,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(37,64,95,0.35) 1px, transparent 1px)'
      },
      backgroundSize: {
        grid: '28px 28px'
      }
    }
  },
  plugins: []
};
