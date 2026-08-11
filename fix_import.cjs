const fs = require('fs');
const content = fs.readFileSync('crawler.ts', 'utf8');

// Move import process from 'node:process'; to the top
const importLine = "import process from 'node:process';\n";
const cleanContent = content.replace("import process from 'node:process';\n", '');

// Add to top right after other imports
const newContent = cleanContent.replace(
  "import pLimit from 'p-limit';",
  "import pLimit from 'p-limit';\n" + importLine
);

fs.writeFileSync('crawler.ts', newContent);
