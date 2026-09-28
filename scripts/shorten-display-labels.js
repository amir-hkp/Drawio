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

const changes = [
  {
    filename: "Tools and Libraries.xml",
    current: "Data Tokenization & Embedding Tools",
    display: "Tokenization & Embedding",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "Data Augmentation Tools",
    display: "Augmentation Tools",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "Feature Engineering Tools & Libraries",
    display: "Feature Engineering Tools",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "Data Labeling Tools",
    display: "Labeling Tools",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "ML Development & Evaluation Frameworks & Libraries",
    display: "ML Frameworks",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "Data Visualization & EDA Tools & Libraries",
    display: "EDA & Visualization Tools",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "Data Processing Tools & Libraries",
    display: "Data Processing Tools",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "Model Explainability Tools",
    display: "Explainability Tools",
  },
  {
    filename: "Tools and Libraries.xml",
    current: "Bias & Fairness Monitoring Tool",
    display: "Bias & Fairness Tool",
  },
  {
    filename: "Pipelines and Processes.xml",
    current: "Embedding Generation & Vectorization",
    display: "Embedding & Vectorization",
  },
  {
    filename: "Pipelines and Processes.xml",
    current: "Requirements Elicitation",
    display: "Requirements Gathering",
  },
  {
    filename: "Pipelines and Processes.xml",
    current: "Model Selection & Building",
    display: "Model Build & Selection",
  },
  {
    filename: "Pipelines and Processes.xml",
    current: "Exploration & Exploitation Process",
    display: "Explore-Exploit Process",
  },
  {
    filename: "Governance and Operations.xml",
    current: "Data Lineage & Provenance",
    display: "Lineage & Provenance",
  },
  {
    filename: "Datasets.xml",
    current: "Pre-collected RL Data / SARS Tuples",
    display: "Pre-collected RL Data",
  },
  {
    filename: "Storage and Data Infrastructure.xml",
    current: "Cloud Computing & Hosting Services",
    display: "Cloud Hosting Services",
  },
  {
    filename: "Model Internals and Configuration.xml",
    current: "Environment Hyperparameters",
    display: "Environment Hyperparams",
  },
  {
    filename: "Network Assets.xml",
    current: "Communication Protocols",
    display: "Network Protocols",
  },
  {
    filename: "Data Artefact.xml",
    current: "States and Observations",
    display: "States & Observations",
  },
];

const grouped = new Map();
for (const change of changes) {
  const group = grouped.get(change.filename) || [];
  group.push(change);
  grouped.set(change.filename, group);
}

for (const [filename, fileChanges] of grouped.entries()) {
  const libraryPath = path.resolve(__dirname, "..", filename);
  const source = fs.readFileSync(libraryPath, "utf8");
  const wrapper = source.match(/^(<mxlibrary>)([\s\S]*)(<\/mxlibrary>\s*)$/);
  if (!wrapper) {
    throw new Error(`Invalid draw.io library wrapper: ${filename}`);
  }

  const entries = JSON.parse(wrapper[2]);
  for (const change of fileChanges) {
    const entry = entries.find((candidate) => {
      const values = [...String(candidate.xml || "").matchAll(/\bvalue="([^"]*)"/g)];
      const xml = String(candidate.xml || "");
      return values.some((match) =>
        [change.current, change.display, "Data Provenance"].includes(normalize(match[1])),
      ) || xml.includes(`astAssetLabel=${encodeURIComponent(change.current)}`);
    });
    if (!entry) {
      throw new Error(`Palette entry not found: ${filename} / ${change.current}`);
    }

    let changedCell = false;
    entry.xml = entry.xml.replace(/&lt;mxCell\b(?:(?!&gt;)[\s\S])*?&gt;/g, (cellTag) => {
      const valueMatch = cellTag.match(/\bvalue="([^"]*)"/);
      const styleMatch = cellTag.match(/\bstyle="([^"]*)"/);
      const currentValue = valueMatch ? normalize(valueMatch[1]) : "";
      const hasCanonicalMetadata = styleMatch
        ? styleMatch[1].includes(`astAssetLabel=${encodeURIComponent(change.current)}`)
        : false;
      if (
        !valueMatch ||
        !styleMatch ||
        (!hasCanonicalMetadata && ![change.current, change.display, "Data Provenance"].includes(currentValue))
      ) {
        return cellTag;
      }

      changedCell = true;
      const style = setStyleValue(
        styleMatch[1],
        "astAssetLabel",
        encodeURIComponent(change.current),
      );
      const encodedDisplay = change.display
        .replace(/&/g, "&amp;amp;")
        .replace(/</g, "&amp;lt;")
        .replace(/>/g, "&amp;gt;");
      return cellTag
        .replace(valueMatch[0], `value="${encodedDisplay}"`)
        .replace(styleMatch[0], `style="${style}"`);
    });
    if (!changedCell) {
      throw new Error(`Could not update ${filename} / ${change.current}`);
    }
  }

  fs.writeFileSync(
    libraryPath,
    `${wrapper[1]}${JSON.stringify(entries, null, 2)}${wrapper[3]}`,
  );
}

// The LLM Model uses the same image as the other model assets, but its short
// label makes it appear visually larger in the compact palette grid. Reduce
// only its thumbnail/drop geometry slightly; its canonical name is unchanged.
{
  const filename = "Model Assets.xml";
  const libraryPath = path.resolve(__dirname, "..", filename);
  const source = fs.readFileSync(libraryPath, "utf8");
  const wrapper = source.match(/^(<mxlibrary>)([\s\S]*)(<\/mxlibrary>\s*)$/);
  if (!wrapper) {
    throw new Error(`Invalid draw.io library wrapper: ${filename}`);
  }
  const entries = JSON.parse(wrapper[2]);
  const entry = entries.find((candidate) =>
    /\bvalue="LLM Model"/.test(String(candidate.xml || "")),
  );
  if (!entry) {
    throw new Error("Palette entry not found: Model Assets.xml / LLM Model");
  }
  const original = entry.xml;
  entry.xml = entry.xml.replace(
    /(&lt;mxGeometry\b[^&]*\bheight=")39\.06("\s+width=")40\.99("[^&]*&gt;)/,
    "$135.94$237.71$3",
  );
  if (entry.xml === original && !/height="35\.94"\s+width="37\.71"/.test(entry.xml)) {
    throw new Error("Could not resize the LLM Model palette geometry");
  }
  fs.writeFileSync(
    libraryPath,
    `${wrapper[1]}${JSON.stringify(entries, null, 2)}${wrapper[3]}`,
  );
}

console.log(`Shortened ${changes.length} display labels and resized LLM Model.`);
