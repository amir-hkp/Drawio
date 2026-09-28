const fs = require("fs");
const path = require("path");

const normalize = (value) => value
  .replace(/&amp;nbsp;|&nbsp;/g, " ")
  .replace(/&amp;lt;|&lt;/g, "<")
  .replace(/&amp;gt;|&gt;/g, ">")
  .replace(/&amp;quot;|&quot;/g, '"')
  .replace(/&amp;amp;/g, "&")
  .replace(/&amp;/g, "&")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const setStyleValue = (style, key, value) => {
  const expression = new RegExp(`(?:^|;)${key}=[^;]*;?`);
  if (expression.test(style)) {
    return style.replace(expression, (match) => {
      const prefix = match.startsWith(";") ? ";" : "";
      return `${prefix}${key}=${value};`;
    });
  }
  return `${style}${style.endsWith(";") || !style ? "" : ";"}${key}=${value};`;
};

const edits = [
  {
    filename: "Model Assets.xml",
    label: "LLM Model",
    width: "40.99",
    height: "39.06",
  },
  {
    filename: "Network Assets.xml",
    label: "Gateways",
    styles: {
      fontSize: "10",
      spacingTop: "-5",
      whiteSpace: "wrap",
      html: "1",
      labelWidth: "64",
    },
  },
  {
    filename: "Pipelines and Processes.xml",
    label: "Model Monitoring",
    width: "40",
    height: "40",
    styles: {
      fontSize: "10",
      spacingTop: "-6",
      whiteSpace: "wrap",
      html: "1",
      labelWidth: "64",
    },
  },
  {
    filename: "Pipelines and Processes.xml",
    label: "RAG Pipeline",
    width: "40",
    height: "40",
  },
  {
    filename: "Pipelines and Processes.xml",
    label: "Requirements Gathering",
    width: "40",
    height: "40",
  },
  {
    filename: "Pipelines and Processes.xml",
    label: "Model Tuning",
    width: "40",
    height: "40",
  },
  {
    filename: "Pipelines and Processes.xml",
    label: "Offline Policy",
    width: "40",
    height: "40",
  },
  {
    filename: "Pipelines and Processes.xml",
    label: "Online Policy",
    width: "40",
    height: "40",
  },
  {
    filename: "Model Internals and Configuration.xml",
    label: "Model Hyperparameters",
    width: "44.98",
    height: "42.25",
  },
];

const grouped = new Map();
for (const edit of edits) {
  const group = grouped.get(edit.filename) || [];
  group.push(edit);
  grouped.set(edit.filename, group);
}

for (const [filename, fileEdits] of grouped.entries()) {
  const libraryPath = path.resolve(__dirname, "..", filename);
  const source = fs.readFileSync(libraryPath, "utf8");
  const wrapper = source.match(/^(<mxlibrary>)([\s\S]*)(<\/mxlibrary>\s*)$/);
  if (!wrapper) {
    throw new Error(`Invalid draw.io library wrapper: ${filename}`);
  }
  const entries = JSON.parse(wrapper[2]);

  for (const edit of fileEdits) {
    const entry = entries.find((candidate) =>
      [...String(candidate.xml || "").matchAll(/\bvalue="([^"]*)"/g)]
        .some((match) => normalize(match[1]) === edit.label),
    );
    if (!entry) {
      throw new Error(`Palette entry not found: ${filename} / ${edit.label}`);
    }

    let updated = false;
    entry.xml = entry.xml.replace(
      /&lt;mxCell\b(?:(?!&gt;)[\s\S])*?&gt;/g,
      (cellTag) => {
        const valueMatch = cellTag.match(/\bvalue="([^"]*)"/);
        const styleMatch = cellTag.match(/\bstyle="([^"]*)"/);
        if (!valueMatch || !styleMatch || normalize(valueMatch[1]) !== edit.label) {
          return cellTag;
        }

        let style = styleMatch[1];
        for (const [key, value] of Object.entries(edit.styles || {})) {
          style = setStyleValue(style, key, value);
        }
        cellTag = cellTag.replace(styleMatch[0], `style="${style}"`);
        updated = true;
        return cellTag;
      },
    );
    if (!updated) {
      throw new Error(`Could not update ${filename} / ${edit.label}`);
    }

    if (edit.width || edit.height) {
      let geometryUpdated = false;
      entry.xml = entry.xml.replace(/&lt;mxGeometry\b(?:(?!&gt;)[\s\S])*?&gt;/, (geometry) => {
        let result = geometry;
        if (edit.height) {
          result = /\bheight="[^"]*"/.test(result)
            ? result.replace(/\bheight="[^"]*"/, `height="${edit.height}"`)
            : result.replace(/&gt;$/, ` height="${edit.height}"&gt;`);
        }
        if (edit.width) {
          result = /\bwidth="[^"]*"/.test(result)
            ? result.replace(/\bwidth="[^"]*"/, `width="${edit.width}"`)
            : result.replace(/&gt;$/, ` width="${edit.width}"&gt;`);
        }
        geometryUpdated = true;
        return result;
      });
      if (!geometryUpdated) {
        throw new Error(`Could not resize ${filename} / ${edit.label}`);
      }
    }
  }

  fs.writeFileSync(
    libraryPath,
    `${wrapper[1]}${JSON.stringify(entries, null, 2)}${wrapper[3]}`,
  );
}

console.log(`Normalized ${edits.length} palette thumbnails.`);
