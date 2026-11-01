import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('Compiling Electron TypeScript...');
execSync('npx tsc -p electron/tsconfig.json', { stdio: 'inherit' });

// Ensure dist-electron treats files as CommonJS
const pkgPath = path.resolve('dist-electron', 'package.json');
fs.writeFileSync(pkgPath, JSON.stringify({ type: 'commonjs' }, null, 2), 'utf-8');

console.log('Electron build completed successfully.');
