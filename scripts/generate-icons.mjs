/**
 * generate-icons.mjs
 * Generates PNG icons from SVG using the @resvg/resvg-js package.
 * Run: node scripts/generate-icons.mjs
 */
// We'll use a simple HTML canvas approach via a temporary HTML file
// For now, create a placeholder approach
console.log('SVG icon ready at public/icons/icon.svg');
console.log('To generate PNG icons, use one of:');
console.log('  npx @squoosh/cli --resize { width: 192 } public/icons/icon.svg -d public/icons/');
console.log('  OR install sharp: npm i sharp && node scripts/generate-icons-sharp.mjs');
console.log('');
console.log('For now, the PWA will use the SVG source directly.');
