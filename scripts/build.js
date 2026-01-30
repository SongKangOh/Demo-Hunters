#!/usr/bin/env node
/**
 * Build Script for Demo-Hunters Chrome Extension
 * 
 * This script injects environment variables from .env file into the extension code.
 * Run: node scripts/build.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const backgroundSrcPath = path.join(rootDir, 'background', 'background.js');
const distDir = path.join(rootDir, 'dist');
const distBackgroundPath = path.join(distDir, 'background', 'background.js');

// Parse .env file
function parseEnvFile(filePath) {
    const env = {};

    if (!fs.existsSync(filePath)) {
        console.error('❌ Error: .env file not found!');
        console.log('📝 Create a .env file based on .env.example');
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key) {
                env[key.trim()] = valueParts.join('=').trim();
            }
        }
    }

    return env;
}

// Main build function
function build() {
    console.log('🔨 Building Demo-Hunters Extension...\n');

    // Parse environment variables
    const env = parseEnvFile(envPath);

    if (!env.CLAUDE_API_KEY) {
        console.error('❌ Error: CLAUDE_API_KEY not found in .env file!');
        process.exit(1);
    }

    console.log('✅ Environment variables loaded');

    // Create dist directory structure
    const dirsToCreate = [
        distDir,
        path.join(distDir, 'background'),
        path.join(distDir, 'content'),
        path.join(distDir, 'popup'),
        path.join(distDir, 'icons')
    ];

    for (const dir of dirsToCreate) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    console.log('✅ Created dist directory structure');

    // Read and process background.js
    let backgroundContent = fs.readFileSync(backgroundSrcPath, 'utf-8');

    // Replace the API key placeholder
    backgroundContent = backgroundContent.replace(
        /const CLAUDE_API_KEY = '[^']*';/,
        `const CLAUDE_API_KEY = '${env.CLAUDE_API_KEY}';`
    );

    // Write processed background.js
    fs.writeFileSync(distBackgroundPath, backgroundContent);
    console.log('✅ Processed background/background.js');

    // Copy other files
    const filesToCopy = [
        { src: 'manifest.json', dest: 'manifest.json' },
        { src: 'content/content.js', dest: 'content/content.js' },
        { src: 'content/content.css', dest: 'content/content.css' },
        { src: 'popup/popup.html', dest: 'popup/popup.html' },
        { src: 'popup/popup.js', dest: 'popup/popup.js' },
        { src: 'popup/popup.css', dest: 'popup/popup.css' }
    ];

    // Copy icons
    const iconsDir = path.join(rootDir, 'icons');
    if (fs.existsSync(iconsDir)) {
        const icons = fs.readdirSync(iconsDir);
        for (const icon of icons) {
            filesToCopy.push({ src: `icons/${icon}`, dest: `icons/${icon}` });
        }
    }

    for (const file of filesToCopy) {
        const srcPath = path.join(rootDir, file.src);
        const destPath = path.join(distDir, file.dest);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`✅ Copied ${file.src}`);
        } else {
            console.log(`⚠️  Skipped ${file.src} (not found)`);
        }
    }

    console.log('\n🎉 Build complete!');
    console.log(`📁 Output: ${distDir}`);
    console.log('\n💡 Load the "dist" folder as an unpacked extension in Chrome.');
}

// Run build
build();
