const fs = require('fs');

try {
  const data = fs.readFileSync('public/library.json', 'utf8');
  console.log('First 100 characters:', data.substring(0, 100));
  JSON.parse(data);
  console.log('JSON is valid');
} catch (e) {
  console.log('JSON is invalid:', e.message);
}