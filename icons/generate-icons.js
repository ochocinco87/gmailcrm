// Script to generate PNG icons from SVG
// Run this script with Node.js after installing the required package:
// npm install sharp

const fs = require('fs');
const sharp = require('sharp');

const svgBuffer = fs.readFileSync('./icon.svg');

// Generate 16x16 icon
sharp(svgBuffer)
  .resize(16, 16)
  .png()
  .toFile('./icon16.png')
  .then(() => console.log('Generated icon16.png'));

// Generate 48x48 icon
sharp(svgBuffer)
  .resize(48, 48)
  .png()
  .toFile('./icon48.png')
  .then(() => console.log('Generated icon48.png'));

// Generate 128x128 icon
sharp(svgBuffer)
  .resize(128, 128)
  .png()
  .toFile('./icon128.png')
  .then(() => console.log('Generated icon128.png'));
