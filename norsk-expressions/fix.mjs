// fix.mjs — патчит gemini_bulk.mjs, запустить один раз
// node fix.mjs

import { readFileSync, writeFileSync } from 'fs';

const file = './gemini_bulk.mjs';
let content = readFileSync(file, 'utf-8');

const oldParse = `  try { return JSON.parse(clean); }
  catch (e) { console.error('JSON error:', e.message); console.error('Parse error:', clean.slice(0, 200)); return []; }`;

const newParse = `  try { return JSON.parse(clean); }
  catch (e1) {
    // Gemini sometimes truncates JSON — try to repair
    try {
      let repaired = clean;
      // Remove trailing comma before closing bracket
      repaired = repaired.replace(/,\\s*\\]\\s*$/, ']');
      // If truncated mid-object, close it
      if (!repaired.trim().endsWith(']')) {
        // Count open braces
        let open = 0;
        for (const ch of repaired) {
          if (ch === '{') open++;
          if (ch === '}') open--;
        }
        // Close unclosed objects
        repaired = repaired.replace(/,?\\s*$/, '');
        for (let i = 0; i < open; i++) repaired += '}';
        if (!repaired.trim().endsWith(']')) repaired += ']';
      }
      const result = JSON.parse(repaired);
      console.log(\`  [REPAIRED] parsed \${result.length} items after repair\`);
      return result;
    } catch (e2) {
      console.error('JSON error:', e1.message);
      console.error('Parse error:', clean.slice(0, 300));
      return [];
    }
  }`;

if (content.includes(oldParse)) {
  content = content.replace(oldParse, newParse);
  writeFileSync(file, content, 'utf-8');
  console.log('Patched OK');
} else {
  console.log('Pattern not found — checking what is there...');
  const idx = content.indexOf("catch (e) { console.error('JSON error'");
  console.log('Found at index:', idx);
  console.log('Context:', content.slice(Math.max(0, idx-50), idx+100));
}
