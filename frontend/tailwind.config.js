/** @type {import('tailwindcss').Config} */

const withMT = require("@material-tailwind/react/utils/withMT");

module.exports = withMT({
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
})

