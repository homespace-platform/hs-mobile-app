const { platformSelect } = require('nativewind/theme');

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
        'danger-solid',
        'on-danger-solid',
        'success',
        'success-soft',
        'warning',
        'warning-soft',
        'news-legal',
        'preview-light',
        'preview-light-card',
        'preview-dark',
        'preview-dark-card',
        'preview-accent',
      ].map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`])
    ),
    extend: {
      // The preset's Android value, "mono", is not an Android font family: font-mono drew sans.
      fontFamily: { mono: platformSelect({ android: 'monospace', ios: "'Courier New'" }) },
    },
  },
  plugins: [],
};
