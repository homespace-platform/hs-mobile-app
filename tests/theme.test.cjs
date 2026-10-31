const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const postcss = require('postcss');

// Exercise the same native CSS transform as Metro, not the web Tailwind output.
process.env.NATIVEWIND_OS = 'android';
const tailwind = require('tailwindcss');
const { cssToReactNativeRuntime } = require('react-native-css-interop/css-to-rn');
const root = path.resolve(__dirname, '..');
const config = require('../tailwind.config');
const compiled = postcss([tailwind(config)])
  .process(fs.readFileSync(path.join(root, 'global.css'), 'utf8'), {
    from: path.join(root, 'global.css'),
  })
  .then(({ css }) => cssToReactNativeRuntime(css));

test('all semantic colors compile for both light and dark native themes', async () => {
  const native = await compiled;
  assert.match(native.flags.darkMode, /^class/);
  for (const token of Object.keys(config.theme.colors)) {
    const variable = native.rootVariables[`--color-${token}`];
    assert.ok(variable, `Missing CSS variable: ${token}`);
    for (const scheme of ['light', 'dark']) {
      assert.equal(variable[scheme]?.length, 3, `${token} missing ${scheme} RGB channels`);
    }
  }
  assert.notDeepEqual(
    native.rootVariables['--color-surface'].light,
    native.rootVariables['--color-surface'].dark
  );
  for (const utility of ['bg-background', 'bg-surface', 'text-primary', 'bg-on-brand/15']) {
    assert.ok(native.rules[utility]?.n?.length, `Missing native utility: ${utility}`);
  }
});

test('input placeholder and selection colors reach native props', async () => {
  const { rules } = await compiled;
  for (const [utility, prop] of [
    ['placeholder:text-subtle', 'placeholderTextColor'],
    ['selection:text-primary', 'selectionColor'],
  ]) {
    assert.ok(JSON.stringify(rules[utility]).includes(prop), `${utility} does not set ${prop}`);
  }
});

function luminance(rgb) {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test('text and button token pairs retain readable contrast in both themes', async () => {
  const { rootVariables } = await compiled;
  const pairs = [
    ['foreground', 'surface'],
    ['foreground', 'background'],
    ['secondary', 'surface'],
    ['muted-foreground', 'surface'],
    ['subtle', 'surface'],
    ['primary', 'primary-soft'],
    ['on-brand', 'brand'],
    ['on-inverse', 'inverse'],
    ['on-disabled', 'disabled'],
    ['danger', 'danger-soft'],
    ['success', 'success-soft'],
    ['warning', 'warning-soft'],
  ];
  for (const scheme of ['light', 'dark']) {
    for (const [text, background] of pairs) {
      const a = luminance(rootVariables[`--color-${text}`][scheme]);
      const b = luminance(rootVariables[`--color-${background}`][scheme]);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(
        ratio >= 4.5,
        `${scheme}: ${text} on ${background} has contrast ${ratio.toFixed(2)}`
      );
    }
  }
});

test('current and future UI files use semantic colors', () => {
  const files = [
    'App.tsx',
    ...fs
      .readdirSync(path.join(root, 'src'), { recursive: true })
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => path.join('src', name)),
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /#[\da-f]{3,8}\b|rgba?\(/i, `Hardcoded color in ${file}`);
    assert.doesNotMatch(
      source,
      /(?:bg|text|border)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+)/,
      `Palette color in ${file}`
    );
  }
});
