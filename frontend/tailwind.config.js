/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
      "../templates/**/*.html",
      "../templates/**/*.j2",
      "../*.py",
  ],
  theme: {
    extend: {
        fontFamily: {
            display: ['"Clash Display"', 'sans-serif'],
            accent: ['"TASA Orbiter Display"', 'serif'],
            body: ['-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        }
    },
  },
  plugins: [],
}

