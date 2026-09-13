const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'node_modules', '@frida', 'net', 'lib', 'adapter.js');
const sourcePath = path.join(__dirname, 'adapter.js');

if (fs.existsSync(sourcePath) && fs.existsSync(path.dirname(targetPath))) {
  try {
    fs.copyFileSync(sourcePath, targetPath);
    console.log('[+] Applied @frida/net adapter.js patch successfully.');
  } catch (err) {
    console.warn(`[!] Failed to apply adapter.js patch: ${err.message}`);
  }
}
