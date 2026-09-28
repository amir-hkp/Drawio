const fs = require("fs");
const path = require("path");

const changed = [];

const normalize = (value) => value
  .replace(/&amp;nbsp;|&nbsp;/g, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const libraries = [
  {
    filename: "Pipelines and Processes.xml",
    entries: [
      { current: "Data Augmentation", replacement: "Data Augmentation" },
      { current: "Data Labeling", replacement: "Data Labeling" },
    ],
  },
  {
    filename: "Tools and Libraries.xml",
    entries: [
      { title: "Data Augmentation Tools", replacement: "Data Augmentation Tools" },
      { title: "Data Labeling Tools", replacement: "Data Labeling Tools" },
    ],
  },
];

for (const library of libraries) {
  const libraryPath = path.resolve(__dirname, "..", library.filename);
  const source = fs.readFileSync(libraryPath, "utf8");
  const match = source.match(/^(<mxlibrary>)([\s\S]*)(<\/mxlibrary>\s*)$/);
  if (!match) {
    throw new Error(`Invalid draw.io library wrapper: ${library.filename}`);
  }

  const entries = JSON.parse(match[2]);
  for (const target of library.entries) {
    const entry = entries.find((candidate) => {
      if (target.title) {
        return candidate.title === target.title;
      }
      const value = candidate.xml?.match(/\bvalue="([^"]*)"/)?.[1] || "";
      return normalize(value) === target.current;
    });
    if (!entry || typeof entry.xml !== "string") {
      throw new Error(`Palette entry not found: ${target.replacement}`);
    }

    let replaced = false;
    entry.xml = entry.xml.replace(
      /(&lt;mxCell\b(?:(?!&gt;)[\s\S])*?\bvalue=")([^"]*)("(?:(?!&gt;)[\s\S])*?\bvertex="1"(?:(?!&gt;)[\s\S])*?&gt;)/,
      (_cell, before, _value, after) => {
        replaced = true;
        return `${before}${target.replacement}${after}`;
      },
    );
    if (!replaced) {
      throw new Error(`Could not update the visible label for ${target.replacement}`);
    }
    changed.push(target.replacement);
  }

  fs.writeFileSync(
    libraryPath,
    `${match[1]}${JSON.stringify(entries, null, 2)}${match[3]}`,
  );
}

console.log(`Verified ${changed.length} distinct preprocessing asset labels.`);
