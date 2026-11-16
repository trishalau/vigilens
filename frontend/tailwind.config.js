/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#25243A",
        muted: "#77758B",
        canvas: "#FAF9FD",
        lavender: "#F1EDFF",
        accent: "#B9A7F5",
        butter: "#FFF1BD",
        line: "#EAE7F1",
        success: "#2D8A68",
        warning: "#B87915",
        danger: "#C14D5A",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 18px rgba(38, 30, 76, 0.035)",
      },
    },
  },
  plugins: [],
};
