// Shared Design System Configuration for Al-Bunyan App
// This ensures consistent colors, fonts, and radii across all screens and the APK.

window.tailwindConfig = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#001e40",          // Deep Professional Blue
        "primary-container": "#003366",
        "primary-fixed": "#d5e3ff",
        "primary-fixed-dim": "#a7c8ff",
        "on-primary": "#ffffff",
        "secondary": "#525f75",
        "secondary-container": "#d6e3fe",
        "on-secondary": "#ffffff",
        "background": "#f7f9fc",       // Light Gray/Blue background
        "on-background": "#191c1e",
        "surface": "#ffffff",
        "on-surface": "#191c1e",
        "surface-container": "#eceef1",
        "surface-container-low": "#f2f4f7",
        "surface-container-high": "#e6e8eb",
        "surface-container-highest": "#e0e3e6",
        "error": "#d32f2f",            // Standard Error Red
        "success": "#2e7d32",          // Standard Success Green
        "outline": "#737780",
        "outline-variant": "#c3c6d1"
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.5rem",
        "3xl": "2.5rem",
        "full": "9999px"
      },
      fontFamily: {
        "headline": ["Cairo", "sans-serif"],
        "body": ["Tajawal", "sans-serif"],
        "label": ["Tajawal", "sans-serif"]
      }
    }
  }
};

// Apply to Tailwind if it's already loaded, otherwise it will be picked up by script link
if (window.tailwind) {
    tailwind.config = window.tailwindConfig;
}
