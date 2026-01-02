const fs = require('fs');
const path = require('path');

/**
 * Default patterns to ignore when scanning
 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
  '__pycache__',
  '.pytest_cache',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.svg',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
  '*.pdf',
  '*.zip',
  '*.tar',
  '*.gz'
];

/**
 * Supported file extensions for analysis
 */
const SUPPORTED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.java',
  '.cs',
  '.go',
  '.rb',
  '.php',
  '.swift',
  '.kt', '.kts',
  '.rs',
  '.c', '.cpp', '.cc', '.h', '.hpp',
  '.sql',
  '.sh', '.bash',
  '.yml', '.yaml',
  '.json',
  '.xml',
  '.env',
  '.config',
  '.ini',
  '.tf', '.tfvars',
  '.dockerfile',
  '.md',
  '.txt'
];

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath, ignorePatterns = []) {
  const allPatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of allPatterns) {
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (normalizedPath.endsWith(ext)) return true;
    } else if (normalizedPath.includes(`/${pattern}/`) ||
               normalizedPath.endsWith(`/${pattern}`) ||
               normalizedPath === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Check if file extension is supported
 */
function isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  // Also include files without extension that might be configs
  if (!ext) {
    const basename = path.basename(filePath);
    return ['Dockerfile', 'Makefile', 'Jenkinsfile', '.env', '.gitignore'].some(
      name => basename.includes(name) || basename.startsWith('.')
    );
  }
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, options = {}) {
  const {
    ignorePatterns = [],
    maxFileSize = 1024 * 1024, // 1MB default
    followSymlinks = false
  } = options;

  const files = [];

  function scan(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (err) {
      console.warn(`Warning: Cannot read directory ${currentPath}: ${err.message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dirPath, fullPath);

      if (shouldIgnore(relativePath, ignorePatterns)) {
        continue;
      }

      if (entry.isSymbolicLink() && !followSymlinks) {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && isSupportedFile(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.size <= maxFileSize) {
            files.push({
              path: fullPath,
              relativePath,
              size: stats.size,
              extension: path.extname(fullPath).toLowerCase()
            });
          }
        } catch (err) {
          console.warn(`Warning: Cannot stat file ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  scan(dirPath);
  return files;
}

/**
 * Read file content safely
 */
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.warn(`Warning: Cannot read file ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Get file lines with line numbers
 */
function getFileLines(content) {
  if (!content) return [];
  return content.split('\n').map((line, index) => ({
    number: index + 1,
    content: line
  }));
}

module.exports = {
  scanDirectory,
  readFileContent,
  getFileLines,
  shouldIgnore,
  isSupportedFile,
  DEFAULT_IGNORE_PATTERNS,
  SUPPORTED_EXTENSIONS
};
