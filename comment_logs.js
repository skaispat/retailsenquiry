const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace uncommented console.log( with // console.log(
  // Look for console.log preceded by anything EXCEPT // on the same line
  const lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('console.log') && !line.trim().startsWith('//') && !line.includes('// console.log') && !line.includes('/* console.log')) {
      lines[i] = line.replace(/console\.log/g, '// console.log');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    changedFiles++;
    console.log(`Updated: ${file}`);
  }
});

console.log(`Completed. Changed ${changedFiles} files.`);
