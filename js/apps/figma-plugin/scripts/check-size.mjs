import console from 'node:console';
import { statSync } from 'node:fs';
import process from 'node:process';

const LIMIT_KIB = 800;
const size = Math.round(statSync('dist/ui.html').size / 1024);

// Рост выше порога обычно значит, что в окно попали лишние Kotlin-модули.
if (size > LIMIT_KIB) {
    console.error(`dist/ui.html: ${size} КиБ при пороге ${LIMIT_KIB} КиБ`);
    process.exit(1);
}
console.log(`dist/ui.html: ${size} КиБ`);
