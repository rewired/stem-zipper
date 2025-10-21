const path = require('node:path');

module.exports = {
  content: [
    path.join(__dirname, 'src/renderer/index.html'),
    path.join(__dirname, 'src/renderer/src/**/*.{ts,tsx}')
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8'
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
