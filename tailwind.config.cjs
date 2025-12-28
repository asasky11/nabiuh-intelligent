/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F62FE", // أزرق راقٍ للتفاعل
          gold: "#CBA135",    // لمسة فخامة
        },
      },
      fontFamily: {
        arabic: ['"IBM Plex Arabic"', "system-ui", "sans-serif"],
        latin: ['Inter', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};

module.exports = config;
