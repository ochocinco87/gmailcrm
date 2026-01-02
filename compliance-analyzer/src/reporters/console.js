/**
 * Console Reporter
 *
 * Outputs compliance analysis results to the console with colors and formatting.
 */

let chalk;
try {
  chalk = require('chalk');
} catch {
  // Fallback if chalk is not available
  chalk = {
    red: s => s,
    yellow: s => s,
    green: s => s,
    blue: s => s,
    cyan: s => s,
    magenta: s => s,
    gray: s => s,
    white: s => s,
    bold: s => s,
    dim: s => s,
    bgRed: s => s,
    bgYellow: s => s,
    bgGreen: s => s
  };
  chalk.red.bold = s => s;
  chalk.yellow.bold = s => s;
  chalk.green.bold = s => s;
}

/**
 * Severity colors
 */
const severityColors = {
  critical: chalk.bgRed.bold,
  high: chalk.red.bold,
  medium: chalk.yellow.bold,
  low: chalk.blue,
  info: chalk.gray
};

/**
 * Severity icons
 */
const severityIcons = {
  critical: '[X]',
  high: '[!]',
  medium: '[~]',
  low: '[-]',
  info: '[i]'
};

/**
 * Format a single finding for console output
 */
function formatFinding(finding, options = {}) {
  const { showContext = true, compact = false } = options;

  const color = severityColors[finding.severity] || chalk.white;
  const icon = severityIcons[finding.severity] || '[-]';

  const lines = [];

  // Header line
  const header = `${icon} ${finding.ruleId}: ${finding.ruleName}`;
  lines.push(color(header));

  // Location
  const location = `   ${chalk.cyan(finding.file)}:${chalk.yellow(finding.lineNumber)}`;
  lines.push(location);

  if (!compact) {
    // Severity and Standard
    lines.push(`   ${chalk.dim('Severity:')} ${color(finding.severity.toUpperCase())} | ${chalk.dim('Standard:')} ${finding.standard}`);

    // Category
    lines.push(`   ${chalk.dim('Category:')} ${finding.category}`);

    // Description
    lines.push(`   ${chalk.dim('Issue:')} ${finding.description}`);

    // Matched text (truncated)
    if (finding.matchedText) {
      const matched = finding.matchedText.length > 60
        ? finding.matchedText.substring(0, 60) + '...'
        : finding.matchedText;
      lines.push(`   ${chalk.dim('Matched:')} ${chalk.red(matched)}`);
    }

    // Context
    if (showContext && finding.context && finding.context.length > 0) {
      lines.push(`   ${chalk.dim('Context:')}`);
      for (const ctx of finding.context) {
        const prefix = ctx.isMatch ? chalk.red('>') : ' ';
        const lineNum = chalk.dim(String(ctx.lineNumber).padStart(4));
        const content = ctx.isMatch ? chalk.red(ctx.content) : chalk.dim(ctx.content);
        lines.push(`   ${prefix} ${lineNum} | ${content}`);
      }
    }

    // Recommendation
    lines.push(`   ${chalk.green('Fix:')} ${finding.recommendation}`);

    // References
    if (finding.references && finding.references.length > 0) {
      lines.push(`   ${chalk.dim('Refs:')} ${finding.references.join(', ')}`);
    }
  }

  lines.push(''); // Empty line separator

  return lines.join('\n');
}

/**
 * Format the summary section
 */
function formatSummary(report) {
  const lines = [];

  lines.push('');
  lines.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
  lines.push(chalk.bold.cyan('                    COMPLIANCE ANALYSIS REPORT'));
  lines.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
  lines.push('');

  // Timestamp and duration
  lines.push(`${chalk.dim('Timestamp:')} ${report.summary.timestamp}`);
  lines.push(`${chalk.dim('Duration:')}  ${report.summary.duration}`);
  lines.push(`${chalk.dim('Files:')}     ${report.summary.filesAnalyzed} analyzed`);
  lines.push('');

  // Compliance Score
  const score = report.summary.complianceScore;
  let scoreColor;
  if (score >= 90) scoreColor = chalk.green.bold;
  else if (score >= 70) scoreColor = chalk.yellow.bold;
  else if (score >= 50) scoreColor = chalk.red;
  else scoreColor = chalk.bgRed.bold;

  lines.push(chalk.bold('COMPLIANCE SCORE'));
  lines.push(`  ${scoreColor(`${score}/100`)} ${getScoreBar(score)}`);
  lines.push('');

  // Findings count by severity
  lines.push(chalk.bold('FINDINGS BY SEVERITY'));
  lines.push(`  ${severityColors.critical('CRITICAL')}: ${report.counts.critical}`);
  lines.push(`  ${severityColors.high('HIGH')}:     ${report.counts.high}`);
  lines.push(`  ${severityColors.medium('MEDIUM')}:   ${report.counts.medium}`);
  lines.push(`  ${severityColors.low('LOW')}:      ${report.counts.low}`);
  lines.push(`  ${severityColors.info('INFO')}:     ${report.counts.info}`);
  lines.push('');

  // By Standard
  lines.push(chalk.bold('FINDINGS BY STANDARD'));
  for (const [standard, findings] of Object.entries(report.byStandard)) {
    lines.push(`  ${chalk.cyan(standard)}: ${findings.length}`);
  }
  lines.push('');

  // Pass/Fail status
  if (report.passed) {
    lines.push(chalk.bgGreen.bold(' PASSED ') + ' No critical or high severity issues found');
  } else {
    lines.push(chalk.bgRed.bold(' FAILED ') + ' Critical or high severity issues detected');
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a visual score bar
 */
function getScoreBar(score) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  let bar;
  if (score >= 90) {
    bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  } else if (score >= 70) {
    bar = chalk.yellow('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  } else {
    bar = chalk.red('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  }

  return `[${bar}]`;
}

/**
 * Format findings by file
 */
function formatByFile(report, options = {}) {
  const lines = [];

  lines.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
  lines.push(chalk.bold('                         DETAILED FINDINGS'));
  lines.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
  lines.push('');

  for (const [file, findings] of Object.entries(report.byFile)) {
    lines.push(chalk.cyan.bold(`\n📁 ${file}`));
    lines.push(chalk.dim('─'.repeat(60)));

    // Sort by line number
    const sorted = [...findings].sort((a, b) => a.lineNumber - b.lineNumber);

    for (const finding of sorted) {
      lines.push(formatFinding(finding, options));
    }
  }

  return lines.join('\n');
}

/**
 * Format top issues
 */
function formatTopIssues(report, limit = 10) {
  const lines = [];

  // Get unique rules with counts
  const ruleCounts = new Map();
  for (const finding of report.findings) {
    const key = finding.ruleId;
    if (!ruleCounts.has(key)) {
      ruleCounts.set(key, {
        ruleId: finding.ruleId,
        ruleName: finding.ruleName,
        severity: finding.severity,
        standard: finding.standard,
        count: 0
      });
    }
    ruleCounts.get(key).count++;
  }

  // Sort by count and severity
  const sorted = Array.from(ruleCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  lines.push(chalk.bold('TOP ISSUES'));
  lines.push(chalk.dim('─'.repeat(60)));

  for (const rule of sorted) {
    const color = severityColors[rule.severity] || chalk.white;
    const icon = severityIcons[rule.severity] || '[-]';
    lines.push(`  ${icon} ${color(rule.ruleId)} (${rule.count}x) - ${rule.ruleName}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Generate full console report
 */
function generateConsoleReport(report, options = {}) {
  const {
    showFindings = true,
    showContext = true,
    compact = false,
    limit = 0
  } = options;

  const output = [];

  // Summary
  output.push(formatSummary(report));

  // Top issues
  if (report.findings.length > 0) {
    output.push(formatTopIssues(report));
  }

  // Detailed findings
  if (showFindings && report.findings.length > 0) {
    if (limit > 0) {
      const limitedReport = {
        ...report,
        byFile: {}
      };

      // Limit findings
      const limitedFindings = report.findings.slice(0, limit);
      for (const finding of limitedFindings) {
        if (!limitedReport.byFile[finding.file]) {
          limitedReport.byFile[finding.file] = [];
        }
        limitedReport.byFile[finding.file].push(finding);
      }

      output.push(formatByFile(limitedReport, { showContext, compact }));

      if (report.findings.length > limit) {
        output.push(chalk.dim(`\n... and ${report.findings.length - limit} more findings\n`));
      }
    } else {
      output.push(formatByFile(report, { showContext, compact }));
    }
  }

  // Recommendations section
  if (report.findings.length > 0) {
    output.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
    output.push(chalk.bold('                         NEXT STEPS'));
    output.push(chalk.bold('═══════════════════════════════════════════════════════════════'));
    output.push('');
    output.push('1. Address all CRITICAL severity issues immediately');
    output.push('2. Review and fix HIGH severity issues before deployment');
    output.push('3. Plan remediation for MEDIUM severity issues');
    output.push('4. Consider addressing LOW severity issues in future sprints');
    output.push('');
    output.push(chalk.dim('Run with --output json for machine-readable output'));
    output.push(chalk.dim('Run with --output html for a detailed HTML report'));
    output.push('');
  }

  return output.join('\n');
}

module.exports = {
  generateConsoleReport,
  formatFinding,
  formatSummary,
  formatByFile,
  formatTopIssues
};
