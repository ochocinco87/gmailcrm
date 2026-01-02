/**
 * JSON Reporter
 *
 * Outputs compliance analysis results in JSON format for machine processing.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate JSON report
 */
function generateJSONReport(report, options = {}) {
  const {
    pretty = true,
    includeContext = true
  } = options;

  // Prepare the report data
  const jsonReport = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    summary: report.summary,
    counts: report.counts,
    passed: report.passed,
    findings: includeContext
      ? report.findings
      : report.findings.map(f => {
          const { context, ...rest } = f;
          return rest;
        }),
    byStandard: {
      HIPAA: report.byStandard.HIPAA?.length || 0,
      SOC2: report.byStandard.SOC2?.length || 0
    },
    byCategory: Object.fromEntries(
      Object.entries(report.byCategory).map(([cat, findings]) => [cat, findings.length])
    ),
    affectedFiles: Object.keys(report.byFile),
    rules: getUniqueRules(report.findings)
  };

  if (pretty) {
    return JSON.stringify(jsonReport, null, 2);
  }

  return JSON.stringify(jsonReport);
}

/**
 * Generate SARIF format (Static Analysis Results Interchange Format)
 * Compatible with GitHub Code Scanning, VS Code, and other tools
 */
function generateSARIFReport(report) {
  const sarifReport = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Compliance Code Analyzer',
            version: '1.0.0',
            informationUri: 'https://github.com/compliance-analyzer',
            rules: getUniqueRules(report.findings).map(rule => ({
              id: rule.ruleId,
              name: rule.ruleName,
              shortDescription: {
                text: rule.ruleName
              },
              fullDescription: {
                text: rule.description || rule.ruleName
              },
              defaultConfiguration: {
                level: mapSeverityToSARIF(rule.severity)
              },
              properties: {
                category: rule.category,
                standard: rule.standard,
                tags: [rule.standard, rule.category]
              }
            }))
          }
        },
        results: report.findings.map(finding => ({
          ruleId: finding.ruleId,
          level: mapSeverityToSARIF(finding.severity),
          message: {
            text: `${finding.description}\n\nRecommendation: ${finding.recommendation}`
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: finding.file,
                  uriBaseId: '%SRCROOT%'
                },
                region: {
                  startLine: finding.lineNumber,
                  startColumn: finding.column || 1,
                  snippet: {
                    text: finding.line || ''
                  }
                }
              }
            }
          ],
          properties: {
            standard: finding.standard,
            category: finding.category,
            references: finding.references || []
          }
        }))
      }
    ]
  };

  return JSON.stringify(sarifReport, null, 2);
}

/**
 * Map severity to SARIF level
 */
function mapSeverityToSARIF(severity) {
  const map = {
    critical: 'error',
    high: 'error',
    medium: 'warning',
    low: 'note',
    info: 'note'
  };
  return map[severity] || 'warning';
}

/**
 * Get unique rules from findings
 */
function getUniqueRules(findings) {
  const rules = new Map();

  for (const finding of findings) {
    if (!rules.has(finding.ruleId)) {
      rules.set(finding.ruleId, {
        ruleId: finding.ruleId,
        ruleName: finding.ruleName,
        category: finding.category,
        severity: finding.severity,
        standard: finding.standard,
        description: finding.description,
        recommendation: finding.recommendation,
        references: finding.references,
        count: 0
      });
    }
    rules.get(finding.ruleId).count++;
  }

  return Array.from(rules.values());
}

/**
 * Save JSON report to file
 */
function saveJSONReport(report, filePath, options = {}) {
  const jsonContent = generateJSONReport(report, options);
  const absolutePath = path.resolve(filePath);
  fs.writeFileSync(absolutePath, jsonContent, 'utf-8');
  return absolutePath;
}

/**
 * Save SARIF report to file
 */
function saveSARIFReport(report, filePath) {
  const sarifContent = generateSARIFReport(report);
  const absolutePath = path.resolve(filePath);
  fs.writeFileSync(absolutePath, sarifContent, 'utf-8');
  return absolutePath;
}

module.exports = {
  generateJSONReport,
  generateSARIFReport,
  saveJSONReport,
  saveSARIFReport,
  getUniqueRules
};
