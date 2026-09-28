const fs = require("fs");
const path = require("path");

const normalize = (value) => value
  .replace(/&amp;nbsp;|&nbsp;/g, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const targets = [
  { filename: "Governance and Operations.xml", label: "ACL" },
  { filename: "Storage and Data Infrastructure.xml", label: "Keystore" },
];

for (const target of targets) {
  const libraryPath = path.resolve(__dirname, "..", target.filename);
  const source = fs.readFileSync(libraryPath, "utf8");
  const match = source.match(/^(<mxlibrary>)([\s\S]*)(<\/mxlibrary>\s*)$/);
  if (!match) {
    throw new Error(`Invalid draw.io library wrapper: ${target.filename}`);
  }

  const entries = JSON.parse(match[2]);
  const matchingIndexes = [];
  entries.forEach((entry, index) => {
    const labels = [...String(entry.xml || "").matchAll(/\bvalue="([^"]*)"/g)]
      .map((valueMatch) => normalize(valueMatch[1]));
    if (labels.includes(target.label)) {
      matchingIndexes.push(index);
    }
  });

  if (matchingIndexes.length !== 1) {
    throw new Error(
      `Expected exactly one ${target.label} entry in ${target.filename}, found ${matchingIndexes.length}`,
    );
  }

  entries.splice(matchingIndexes[0], 1);
  fs.writeFileSync(
    libraryPath,
    `${match[1]}${JSON.stringify(entries, null, 2)}${match[3]}`,
  );
  console.log(`Removed ${target.label} from ${target.filename}`);
}
