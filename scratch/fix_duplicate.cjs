const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'AnalyzePage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const originalEndings = content.includes('\r\n') ? '\r\n' : '\n';
let lfContent = content.replace(/\r\n/g, '\n');

const duplicateBlock = "      try {\n        ShadowTester.run(question, tableName, `SELECT * FROM ${tbl}`, rows);\n      } catch (e) { console.warn('Shadow test fail:', e); }\n      try {\n        ShadowTester.run(question, tableName, `SELECT * FROM ${tbl}`, rows);\n      } catch (e) { console.warn('Shadow test fail:', e); }";

const cleanBlock = "      try {\n        ShadowTester.run(question, tableName, `SELECT * FROM ${tbl}`, rows);\n      } catch (e) { console.warn('Shadow test fail:', e); }";

if (lfContent.includes(duplicateBlock)) {
  lfContent = lfContent.replace(duplicateBlock, cleanBlock);
  console.log("Successfully removed duplicate shadow testing call!");
} else {
  console.log("Duplicate block not found or already clean.");
}

let finalContent = lfContent;
if (originalEndings === '\r\n') {
  finalContent = lfContent.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Completed cleanup!");
