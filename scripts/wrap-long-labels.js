const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const minimumLength = 18;
const labelWidth = 64;

const decodeEntities = (value) => value
  .replace(/&amp;nbsp;/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const normalizeLabel = (value) => decodeEntities(value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const addStyle = (style, key, value) => {
  const expression = new RegExp(`(?:^|;)${key}=[^;]*;?`);

  if (expression.test(style)) {
    return style.replace(expression, (match) => {
      const prefix = match.startsWith(';') ? ';' : '';
      return `${prefix}${key}=${value};`;
    });
  }

  return `${style}${style.endsWith(';') || style === '' ? '' : ';'}${key}=${value};`;
};

let changedFiles = 0;
let changedEntries = 0;

for (const filename of fs.readdirSync(repoRoot).filter((name) => name.endsWith('.xml')).sort()) {
  const filePath = path.join(repoRoot, filename);
  const original = fs.readFileSync(filePath, 'utf8');
  const match = original.match(/^(<mxlibrary>)([\s\S]*)(<\/mxlibrary>\s*)$/);

  if (!match) {
    throw new Error(`Invalid draw.io library wrapper: ${filename}`);
  }

  const entries = JSON.parse(match[2]);
  let fileChanged = false;

  for (const entry of entries) {
    if (typeof entry.xml !== 'string') {
      continue;
    }

    let entryChanged = false;
    entry.xml = entry.xml.replace(/&lt;mxCell\b(?:(?!&gt;)[\s\S])*?&gt;/g, (cellTag) => {
      if (!/\bvertex="1"/.test(cellTag)) {
        return cellTag;
      }

      const valueMatch = cellTag.match(/\bvalue="([^"]*)"/);
      const styleMatch = cellTag.match(/\bstyle="([^"]*)"/);

      if (
        !valueMatch ||
        !styleMatch ||
        !styleMatch[1].toLowerCase().includes('shape=image') ||
        normalizeLabel(valueMatch[1]).length < minimumLength
      ) {
        return cellTag;
      }

      let style = styleMatch[1];
      style = addStyle(style, 'whiteSpace', 'wrap');
      style = addStyle(style, 'html', '1');
      style = addStyle(style, 'labelWidth', String(labelWidth));
      entryChanged = true;

      return cellTag.replace(styleMatch[0], `style="${style}"`);
    });

    if (entryChanged) {
      fileChanged = true;
      changedEntries += 1;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(filePath, `${match[1]}${JSON.stringify(entries, null, 2)}${match[3]}`);
    changedFiles += 1;
  }
}

console.log(`Wrapped ${changedEntries} long labels across ${changedFiles} palette libraries.`);
