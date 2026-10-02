/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#170F26',        // deep aubergine — app background
        panel: '#241A38',      // raised panel surface on dark bg
        grid: '#3D2C55',       // gridlines / borders
        paper: '#F1ECFA',      // light surface / primary text on dark
        signal: '#F2A63A',     // amber accent — kept as the contrast pop
        route: '#9385D1',      // soft violet — route/line color
        good: '#4CAF7D',
        bad: '#E2574C',
        ink2: '#B3A3D6'        // secondary text on dark
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      }
    }
  },
  plugins: []
};
