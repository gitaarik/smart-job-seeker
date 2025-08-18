#!/usr/bin/env node

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportResumeToPDF() {
  console.log('🚀 Starting resume PDF export...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2
    });
    
    // Navigate to the resume page
    const resumeUrl = 'http://localhost:5173/resume';
    console.log(`📄 Loading resume from: ${resumeUrl}`);
    
    await page.goto(resumeUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait for fonts and icons to load
    console.log('⏳ Waiting for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Ensure all images are loaded
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        images.map(img => {
          return new Promise((resolve) => {
            if (img.complete) {
              resolve();
            } else {
              img.onload = resolve;
              img.onerror = resolve;
            }
          });
        })
      );
    });
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'Rik_Wanders_Resume.pdf');
    
    // Generate PDF
    console.log('📝 Generating PDF...');
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      printBackground: true,
      preferCSSPageSize: false
    });
    
    console.log(`✅ Resume PDF exported successfully to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error exporting resume to PDF:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Check if development server is running
async function checkDevServer() {
  try {
    const response = await fetch('http://localhost:5173/resume');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const serverRunning = await checkDevServer();
  
  if (!serverRunning) {
    console.error('❌ Development server is not running on http://localhost:5173');
    console.log('💡 Please start the dev server first with: npm run dev');
    process.exit(1);
  }
  
  await exportResumeToPDF();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { exportResumeToPDF };