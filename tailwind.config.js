/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,html}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
