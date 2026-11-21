import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  inputPath: path.join(__dirname, '..', 'src', 'styles', 'tokens.json'),
  outputDir: path.join(__dirname, '..', 'src', 'styles'),
  scssFilename: '_tokens.scss',
  jsFilename: 'tokens.js'
};

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toCamelCase(pathArray) {
  return pathArray
    .map((part, index) => {
      const words = toKebabCase(part).split('-');
      return words
        .map((word, wordIndex) => {
          if (index === 0 && wordIndex === 0) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join('');
    })
    .join('');
}

function flattenTokens(obj, currentPath = []) {
  let items = [];

  for (const [key, value] of Object.entries(obj)) {
    const newPath = [...currentPath, key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      items = items.concat(flattenTokens(value, newPath));
    } else {
      items.push({
        path: newPath,
        value: value
      });
    }
  }

  return items;
}

function generateScss(flattenedTokens) {
  const header = `// ==========================================
// AUTO-GENERATED DESIGN TOKENS (SCSS)
// Do not edit directly. Edit tokens.json
// ==========================================\n\n`;

  const scssVars = flattenedTokens
    .map(({ path, value }) => {
      const varName = '$' + path.map(toKebabCase).join('-');
      return `${varName}: ${value};`;
    })
    .join('\n');

  return header + scssVars + '\n';
}

function generateJs(rawTokens, flattenedTokens) {
  const header = `/**
 * AUTO-GENERATED DESIGN TOKENS (JS)
 * Do not edit directly. Edit tokens.json
 */\n\n`;

  const objectExport = `export const tokens = ${JSON.stringify(rawTokens, null, 2)};\n\n`;

  const flatConstants = flattenedTokens
    .map(({ path, value }) => {
      const constName = toCamelCase(path);
      const formattedValue = typeof value === 'string' ? JSON.stringify(value) : value;
      return `export const ${constName} = ${formattedValue};`;
    })
    .join('\n');

  return header + objectExport + flatConstants + '\n';
}

async function build() {
  try {
    console.log('Generating admin design tokens...');

    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    const rawData = await fs.readFile(CONFIG.inputPath, 'utf8');
    const tokens = JSON.parse(rawData);

    const flattened = flattenTokens(tokens);

    const scssContent = generateScss(flattened);
    const jsContent = generateJs(tokens, flattened);

    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    await fs.mkdir(CONFIG.outputDir, { recursive: true });

    const scssPath = path.join(CONFIG.outputDir, CONFIG.scssFilename);
    const jsPath = path.join(CONFIG.outputDir, CONFIG.jsFilename);

    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    await fs.writeFile(scssPath, scssContent, 'utf8');
    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    await fs.writeFile(jsPath, jsContent, 'utf8');

    console.log(`Generated SCSS: ${scssPath}`);
    console.log(`Generated JS:   ${jsPath}`);
    console.log('Done.');
  } catch (error) {
    console.error('Error generating tokens:', error);
    process.exit(1);
  }
}

build();
