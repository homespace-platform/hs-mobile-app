/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    colors: Object.fromEntries(
      [
        'background',
        'surface',
        'overlay',
        'logo',
        'muted',
        'foreground',
        'secondary',
        'muted-foreground',
        'subtle',
        'border',
        'border-strong',
        'primary',
        'primary-soft',
        'primary-border',
        'brand',
        'on-brand',
        'on-brand-muted',
        'inverse',
        'on-inverse',
        'disabled',
        'on-disabled',
        'danger',
        'danger-soft',
        'success',
        'success-soft',
        'warning',
        'warning-soft',
      ].map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`])
    ),
  },
  plugins: [],
};
