const fs = require('fs');

const data = fs.readFileSync('public/library.json', 'utf8');
console.log('First 200 characters:', JSON.stringify(data.substring(0, 200)));