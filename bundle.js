/**
 * GradeInsights Build / Bundler Script
 * 
 * Packages modular development files (index.html, css/styles.css, js/app.js)
 * into a single standalone HTML file (dist/index.html) for Google Apps Script deployment.
 * 
 * Usage:
 *   node bundle.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const SRC_INDEX = path.join(ROOT_DIR, 'index.html');
const SRC_CSS = path.join(ROOT_DIR, 'css', 'styles.css');
const SRC_JS = path.join(ROOT_DIR, 'js', 'app.js');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');

function bundle() {
  console.log('🚀 Bundling GradeInsights for Google Apps Script...');

  if (!fs.existsSync(SRC_INDEX)) {
    console.error('❌ Error: index.html not found!');
    process.exit(1);
  }

  let indexContent = fs.readFileSync(SRC_INDEX, 'utf8');

  // Inline CSS
  if (fs.existsSync(SRC_CSS)) {
    const cssContent = fs.readFileSync(SRC_CSS, 'utf8');
    const cssTag = `<style>\n${cssContent}\n</style>`;
    indexContent = indexContent.replace(
      /<link\s+rel=["']stylesheet["']\s+href=["']css\/styles\.css["']\s*\/?>/i,
      cssTag
    );
    console.log(`✅ Inlined css/styles.css (${(cssContent.length / 1024).toFixed(1)} KB)`);
  } else {
    console.warn('⚠️ Warning: css/styles.css not found!');
  }

  // Inline JS
  if (fs.existsSync(SRC_JS)) {
    const jsContent = fs.readFileSync(SRC_JS, 'utf8');
    const jsTag = `<script>\n${jsContent}\n</script>`;
    indexContent = indexContent.replace(
      /<script\s+src=["']js\/app\.js["']\s*><\/script>/i,
      jsTag
    );
    console.log(`✅ Inlined js/app.js (${(jsContent.length / 1024).toFixed(1)} KB)`);
  } else {
    console.warn('⚠️ Warning: js/app.js not found!');
  }

  // Ensure dist folder exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  fs.writeFileSync(DIST_INDEX, indexContent, 'utf8');
  const distSize = (fs.statSync(DIST_INDEX).size / 1024).toFixed(1);
  console.log(`🎉 Bundling complete! Generated ${path.relative(ROOT_DIR, DIST_INDEX)} (${distSize} KB)`);
}

bundle();
