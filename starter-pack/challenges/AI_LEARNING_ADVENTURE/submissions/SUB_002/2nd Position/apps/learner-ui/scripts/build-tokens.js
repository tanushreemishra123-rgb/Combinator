import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  inputPath: path.join(__dirname, '..', 'src', 'styles', 'tokens.json'),
  outputDir: path.join(__dirname, '..', 'src', 'styles'),
  scssFilename: '_tokens.scss',
  jsFilename: 'tokens.js'
};

/**
 * Converts camelCase or standard text to kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Converts kebab-case or path array to camelCase
 */
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

/**
 * Recursively flattens nested object into key-value pairs with path arrays
 * e.g., { color: { brand: { primary: '#123' } } }
 * => [ { path: ['color', 'brand', 'primary'], value: '#123' } ]
 */
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

/**
 * Generates SCSS variable content
 */
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

/**
 * Generates JS/ES Module content with both full object & flat constants
 */
function generateJs(rawTokens, flattenedTokens) {
  const header = `/**
 * AUTO-GENERATED DESIGN TOKENS (JS)
 * Do not edit directly. Edit tokens.json
 */\n\n`;

  // 1. Export standard nested object
  const objectExport = `export const tokens = ${JSON.stringify(rawTokens, null, 2)};\n\n`;

  // 2. Export individual flat constants (e.g., export const colorBrandPrimary = "...")
  const flatConstants = flattenedTokens
    .map(({ path, value }) => {
      const constName = toCamelCase(path);
      const formattedValue = typeof value === 'string' ? JSON.stringify(value) : value;
      return `export const ${constName} = ${formattedValue};`;
    })
    .join('\n');

  return header + objectExport + flatConstants + '\n';
}

/**
 * Main execution function
 */
async function build() {
  try {
    console.log('🚀 Generating Design Tokens...');

    // 1. Read input JSON
    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    const rawData = await fs.readFile(CONFIG.inputPath, 'utf8');
    const tokens = JSON.parse(rawData);

    // 2. Process & Flatten
    const flattened = flattenTokens(tokens);

    // 3. Generate contents
    const scssContent = generateScss(flattened);
    const jsContent = generateJs(tokens, flattened);

    // 4. Ensure output directory exists
    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    await fs.mkdir(CONFIG.outputDir, { recursive: true });

    // 5. Write files
    const scssPath = path.join(CONFIG.outputDir, CONFIG.scssFilename);
    const jsPath = path.join(CONFIG.outputDir, CONFIG.jsFilename);

    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    await fs.writeFile(scssPath, scssContent, 'utf8');
    // nosemgrep: gitlab.eslint.detect-non-literal-fs-filename
    await fs.writeFile(jsPath, jsContent, 'utf8');

    console.log(`✅ Generated SCSS: ${scssPath}`);
    console.log(`✅ Generated JS:   ${jsPath}`);
    console.log('🎉 Done!');
  } catch (error) {
    console.error('❌ Error generating tokens:', error);
    process.exit(1);
  }
}

build();