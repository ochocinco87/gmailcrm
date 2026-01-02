#!/usr/bin/env node

/**
 * Compliance Code Analyzer CLI
 *
 * Analyze source code for HIPAA and SOC2 compliance violations.
 *
 * Usage:
 *   compliance-analyzer [options] <directory>
 *
 * Examples:
 *   compliance-analyzer ./src
 *   compliance-analyzer --standard hipaa ./src
 *   compliance-analyzer --output html --report compliance-report.html ./src
 */

const fs = require('fs');
const path = require('path');
const { ComplianceAnalyzer, STANDARDS } = require('./analyzer');
const { generateConsoleReport } = require('./reporters/console');
const { generateJSONReport, generateSARIFReport, saveJSONReport, saveSARIFReport } = require('./reporters/json');
const { generateHTMLReport, saveHTMLReport } = require('./reporters/html');

// Simple chalk fallback for colored output
let chalk;
try {
  chalk = require('chalk');
} catch {
  chalk = {
    red: s => s,
    yellow: s => s,
    green: s => s,
    blue: s => s,
    cyan: s => s,
    bold: s => s,
    dim: s => s
  };
  chalk.red.bold = s => s;
  chalk.green.bold = s => s;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    directory: '.',
    standards: [],
    output: 'console',
    report: null,
    severity: 'low',
    exclude: [],
    include: [],
    ignorePatterns: [],
    showContext: true,
    compact: false,
    limit: 0,
    help: false,
    version: false,
    quiet: false,
    failOnError: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;

      case '-v':
      case '--version':
        options.version = true;
        break;

      case '-s':
      case '--standard':
        i++;
        if (args[i]) {
          const std = args[i].toUpperCase();
          if (std === 'HIPAA' || std === 'SOC2' || std === 'ALL') {
            options.standards.push(std);
          }
        }
        break;

      case '-o':
      case '--output':
        i++;
        if (args[i]) {
          options.output = args[i].toLowerCase();
        }
        break;

      case '-r':
      case '--report':
        i++;
        if (args[i]) {
          options.report = args[i];
        }
        break;

      case '--severity':
        i++;
        if (args[i]) {
          options.severity = args[i].toLowerCase();
        }
        break;

      case '--exclude':
        i++;
        if (args[i]) {
          options.exclude.push(...args[i].split(','));
        }
        break;

      case '--include':
        i++;
        if (args[i]) {
          options.include.push(...args[i].split(','));
        }
        break;

      case '--ignore':
        i++;
        if (args[i]) {
          options.ignorePatterns.push(...args[i].split(','));
        }
        break;

      case '--no-context':
        options.showContext = false;
        break;

      case '--compact':
        options.compact = true;
        break;

      case '--limit':
        i++;
        if (args[i]) {
          options.limit = parseInt(args[i], 10) || 0;
        }
        break;

      case '-q':
      case '--quiet':
        options.quiet = true;
        break;

      case '--fail-on-error':
        options.failOnError = true;
        break;

      default:
        if (!arg.startsWith('-')) {
          options.directory = arg;
        }
        break;
    }
    i++;
  }

  // Default to all standards if none specified
  if (options.standards.length === 0) {
    options.standards = ['ALL'];
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${chalk.bold('Compliance Code Analyzer')}
Analyze source code for HIPAA and SOC2 compliance violations.

${chalk.bold('USAGE')}
  compliance-analyzer [options] <directory>

${chalk.bold('OPTIONS')}
  -h, --help              Show this help message
  -v, --version           Show version number

  -s, --standard <name>   Compliance standard to check (hipaa, soc2, all)
                          Can be specified multiple times. Default: all

  -o, --output <format>   Output format: console, json, sarif, html
                          Default: console

  -r, --report <file>     Save report to file (for json, sarif, html outputs)

  --severity <level>      Minimum severity to report (critical, high, medium, low, info)
                          Default: low (show all)

  --exclude <rules>       Comma-separated list of rule IDs to exclude
  --include <rules>       Comma-separated list of rule IDs to include (only these)

  --ignore <patterns>     Comma-separated patterns to ignore (in addition to defaults)

  --no-context            Don't show code context in console output
  --compact               Use compact output format
  --limit <n>             Limit number of findings shown in console output

  -q, --quiet             Suppress progress output
  --fail-on-error         Exit with code 1 if critical or high severity issues found

${chalk.bold('EXAMPLES')}
  # Analyze current directory for all compliance standards
  compliance-analyzer .

  # Check only HIPAA compliance
  compliance-analyzer --standard hipaa ./src

  # Generate HTML report
  compliance-analyzer --output html --report report.html ./src

  # Generate SARIF report for GitHub Code Scanning
  compliance-analyzer --output sarif --report results.sarif ./src

  # Check with minimum severity of high
  compliance-analyzer --severity high ./src

  # Exclude specific rules
  compliance-analyzer --exclude HIPAA-PHI-001,SOC2-SEC-005 ./src

${chalk.bold('COMPLIANCE STANDARDS')}
  ${chalk.cyan('HIPAA')} - Health Insurance Portability and Accountability Act
         Checks for PHI exposure, encryption, access control, audit logging

  ${chalk.cyan('SOC2')}  - Service Organization Control 2 (Trust Services Criteria)
         Checks for security, availability, processing integrity, confidentiality, privacy

${chalk.bold('SEVERITY LEVELS')}
  ${chalk.red.bold('CRITICAL')} - Immediate action required, likely compliance violation
  ${chalk.red('HIGH')}     - Significant risk, should be addressed before production
  ${chalk.yellow('MEDIUM')}   - Moderate risk, should be addressed in near term
  ${chalk.blue('LOW')}      - Minor risk, consider addressing in future
  ${chalk.dim('INFO')}     - Informational, best practice recommendations

${chalk.bold('EXIT CODES')}
  0 - No critical or high severity issues found
  1 - Critical or high severity issues found (with --fail-on-error)
  2 - Error during analysis

${chalk.dim('For more information, visit: https://github.com/compliance-analyzer')}
`);
}

/**
 * Print version
 */
function printVersion() {
  const pkg = require('../package.json');
  console.log(`v${pkg.version}`);
}

/**
 * Show progress spinner (simple version)
 */
class Progress {
  constructor(quiet = false) {
    this.quiet = quiet;
    this.current = 0;
    this.total = 0;
  }

  start(text) {
    if (!this.quiet) {
      process.stdout.write(`${text}...`);
    }
  }

  update(current, total) {
    this.current = current;
    this.total = total;
    if (!this.quiet && process.stdout.isTTY) {
      process.stdout.write(`\r${'Analyzing'} ${current}/${total} files...`);
    }
  }

  succeed(text) {
    if (!this.quiet) {
      console.log(`\r${chalk.green('✓')} ${text}`);
    }
  }

  fail(text) {
    if (!this.quiet) {
      console.log(`\r${chalk.red('✗')} ${text}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  // Handle help and version
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  // Validate directory
  const targetDir = path.resolve(options.directory);
  if (!fs.existsSync(targetDir)) {
    console.error(chalk.red(`Error: Directory not found: ${targetDir}`));
    process.exit(2);
  }

  if (!fs.statSync(targetDir).isDirectory()) {
    console.error(chalk.red(`Error: Not a directory: ${targetDir}`));
    process.exit(2);
  }

  const progress = new Progress(options.quiet);

  try {
    // Create analyzer
    const analyzer = new ComplianceAnalyzer({
      standards: options.standards,
      severityThreshold: options.severity,
      excludeRules: options.exclude,
      includeRules: options.include,
      ignorePatterns: options.ignorePatterns
    });

    progress.start(`Scanning ${targetDir}`);

    // Run analysis
    const report = await analyzer.analyzeDirectory(targetDir);

    progress.succeed(`Analyzed ${report.summary.filesAnalyzed} files in ${report.summary.duration}`);

    // Generate output
    let outputPath = null;

    switch (options.output) {
      case 'json':
        if (options.report) {
          outputPath = saveJSONReport(report, options.report);
          console.log(chalk.green(`Report saved to: ${outputPath}`));
        } else {
          console.log(generateJSONReport(report));
        }
        break;

      case 'sarif':
        if (options.report) {
          outputPath = saveSARIFReport(report, options.report);
          console.log(chalk.green(`SARIF report saved to: ${outputPath}`));
        } else {
          console.log(generateSARIFReport(report));
        }
        break;

      case 'html':
        if (options.report) {
          outputPath = saveHTMLReport(report, options.report, {
            title: `Compliance Report - ${path.basename(targetDir)}`
          });
          console.log(chalk.green(`HTML report saved to: ${outputPath}`));
        } else {
          // Default filename for HTML
          const defaultPath = `compliance-report-${Date.now()}.html`;
          outputPath = saveHTMLReport(report, defaultPath, {
            title: `Compliance Report - ${path.basename(targetDir)}`
          });
          console.log(chalk.green(`HTML report saved to: ${outputPath}`));
        }
        break;

      case 'console':
      default:
        console.log(generateConsoleReport(report, {
          showContext: options.showContext,
          compact: options.compact,
          limit: options.limit
        }));
        break;
    }

    // Exit with error code if --fail-on-error and issues found
    if (options.failOnError && !report.passed) {
      process.exit(1);
    }

    process.exit(0);

  } catch (error) {
    progress.fail('Analysis failed');
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(2);
  }
}

// Export for programmatic use
module.exports = {
  ComplianceAnalyzer,
  STANDARDS,
  analyze: require('./analyzer').analyze
};

// Run CLI if executed directly
if (require.main === module) {
  main();
}
