/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: '#0A0B10',
        themeBg: '#0A0B10',
        surface: '#1E1E1E',
        gold: '#8D6CE5',
        teal: '#44F1C6',
        red: '#EF4444',
        text: 'rgba(255, 255, 255, 0.92)',
        themeText: 'rgba(255, 255, 255, 0.92)',
        muted: '#A0A0A0',
        input: '#1E1E1E',
        themeInput: '#252525',
        borderDark: '#2C2C2C',
      },
    },
  },
  plugins: [],
}
