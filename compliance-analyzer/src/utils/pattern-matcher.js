/**
 * Pattern matching utilities for compliance analysis
 */

/**
 * Match a pattern against file content and return all matches with context
 */
function matchPattern(content, pattern, options = {}) {
  const {
    contextLines = 2,
    maxMatches = 100
  } = options;

  const lines = content.split('\n');
  const matches = [];
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;

  for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
    const line = lines[i];
    const lineMatches = line.match(regex);

    if (lineMatches) {
      // Get context lines
      const startLine = Math.max(0, i - contextLines);
      const endLine = Math.min(lines.length - 1, i + contextLines);
      const context = [];

      for (let j = startLine; j <= endLine; j++) {
        context.push({
          lineNumber: j + 1,
          content: lines[j],
          isMatch: j === i
        });
      }

      matches.push({
        lineNumber: i + 1,
        column: line.indexOf(lineMatches[0]) + 1,
        matchedText: lineMatches[0],
        line: line,
        context
      });
    }
  }

  return matches;
}

/**
 * Check if content matches any of the given patterns
 */
function matchAnyPattern(content, patterns) {
  const allMatches = [];

  for (const patternDef of patterns) {
    const { pattern, ...rest } = patternDef;
    const matches = matchPattern(content, pattern);

    for (const match of matches) {
      allMatches.push({
        ...match,
        ...rest
      });
    }
  }

  return allMatches;
}

/**
 * Entropy calculation for detecting secrets
 */
function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;

  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;

  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Detect high-entropy strings that might be secrets
 */
function detectHighEntropyStrings(content, options = {}) {
  const {
    minLength = 16,
    maxLength = 200,
    minEntropy = 4.5,
    contextLines = 2
  } = options;

  const lines = content.split('\n');
  const findings = [];

  // Pattern to find potential secrets (quoted strings, assignments)
  const stringPatterns = [
    /['"]([A-Za-z0-9+/=_\-]{16,})['"]/g,
    /=\s*['"]?([A-Za-z0-9+/=_\-]{16,})['"]?/g,
    /:\s*['"]?([A-Za-z0-9+/=_\-]{16,})['"]?/g
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trim().startsWith('//') ||
        line.trim().startsWith('#') ||
        line.trim().startsWith('*')) {
      continue;
    }

    for (const pattern of stringPatterns) {
      pattern.lastIndex = 0; // Reset regex
      let match;

      while ((match = pattern.exec(line)) !== null) {
        const potentialSecret = match[1];

        if (potentialSecret &&
            potentialSecret.length >= minLength &&
            potentialSecret.length <= maxLength) {
          const entropy = calculateEntropy(potentialSecret);

          if (entropy >= minEntropy) {
            // Get context
            const startLine = Math.max(0, i - contextLines);
            const endLine = Math.min(lines.length - 1, i + contextLines);
            const context = [];

            for (let j = startLine; j <= endLine; j++) {
              context.push({
                lineNumber: j + 1,
                content: lines[j],
                isMatch: j === i
              });
            }

            findings.push({
              lineNumber: i + 1,
              column: match.index + 1,
              entropy: entropy.toFixed(2),
              length: potentialSecret.length,
              preview: potentialSecret.substring(0, 8) + '...',
              context
            });
          }
        }
      }
    }
  }

  return findings;
}

/**
 * Check for specific code patterns (like function calls, imports)
 */
function findCodePatterns(content, patterns) {
  const results = [];

  for (const patternDef of patterns) {
    const { name, pattern, ...rest } = patternDef;
    const matches = matchPattern(content, pattern);

    if (matches.length > 0) {
      results.push({
        patternName: name,
        matches,
        ...rest
      });
    }
  }

  return results;
}

module.exports = {
  matchPattern,
  matchAnyPattern,
  calculateEntropy,
  detectHighEntropyStrings,
  findCodePatterns
};
