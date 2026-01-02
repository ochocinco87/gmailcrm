/**
 * Compliance Code Analyzer - Core Engine
 *
 * Analyzes source code for HIPAA and SOC2 compliance violations.
 */

const path = require('path');
const { scanDirectory, readFileContent } = require('./utils/file-scanner');
const { analyzeForHIPAA, HIPAA_CATEGORIES, SEVERITY: HIPAA_SEVERITY } = require('./rules/hipaa');
const { analyzeForSOC2, SOC2_CATEGORIES, SEVERITY: SOC2_SEVERITY } = require('./rules/soc2');

/**
 * Compliance standards supported
 */
const STANDARDS = {
  HIPAA: 'HIPAA',
  SOC2: 'SOC2',
  ALL: 'ALL'
};

/**
 * Analyzer configuration defaults
 */
const DEFAULT_CONFIG = {
  standards: [STANDARDS.ALL],
  ignorePatterns: [],
  maxFileSize: 1024 * 1024, // 1MB
  severityThreshold: 'low', // Report all severities by default
  excludeRules: [],
  includeRules: [], // If set, only these rules are checked
  contextLines: 2
};

/**
 * Severity order for filtering
 */
const SEVERITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0
};

/**
 * Main analyzer class
 */
class ComplianceAnalyzer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.findings = [];
    this.filesAnalyzed = 0;
    this.totalFiles = 0;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Analyze a directory for compliance violations
   */
  async analyzeDirectory(dirPath) {
    this.startTime = new Date();
    this.findings = [];
    this.filesAnalyzed = 0;

    const absolutePath = path.resolve(dirPath);

    // Scan for files
    const files = scanDirectory(absolutePath, {
      ignorePatterns: this.config.ignorePatterns,
      maxFileSize: this.config.maxFileSize
    });

    this.totalFiles = files.length;

    // Analyze each file
    for (const file of files) {
      await this.analyzeFile(file.path, file.relativePath);
      this.filesAnalyzed++;
    }

    this.endTime = new Date();

    return this.getReport();
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath, relativePath = null) {
    const content = readFileContent(filePath);
    if (!content) return [];

    const displayPath = relativePath || filePath;
    let fileFindings = [];

    // Determine which standards to check
    const standards = this.config.standards.includes(STANDARDS.ALL)
      ? [STANDARDS.HIPAA, STANDARDS.SOC2]
      : this.config.standards;

    // Run HIPAA analysis
    if (standards.includes(STANDARDS.HIPAA)) {
      const hipaaFindings = analyzeForHIPAA(content, displayPath);
      fileFindings = fileFindings.concat(
        hipaaFindings.map(f => ({ ...f, standard: STANDARDS.HIPAA }))
      );
    }

    // Run SOC2 analysis
    if (standards.includes(STANDARDS.SOC2)) {
      const soc2Findings = analyzeForSOC2(content, displayPath);
      fileFindings = fileFindings.concat(
        soc2Findings.map(f => ({ ...f, standard: STANDARDS.SOC2 }))
      );
    }

    // Filter by rules
    if (this.config.includeRules.length > 0) {
      fileFindings = fileFindings.filter(f =>
        this.config.includeRules.includes(f.ruleId)
      );
    }

    if (this.config.excludeRules.length > 0) {
      fileFindings = fileFindings.filter(f =>
        !this.config.excludeRules.includes(f.ruleId)
      );
    }

    // Filter by severity threshold
    const thresholdLevel = SEVERITY_ORDER[this.config.severityThreshold] || 0;
    fileFindings = fileFindings.filter(f =>
      SEVERITY_ORDER[f.severity] >= thresholdLevel
    );

    this.findings = this.findings.concat(fileFindings);
    return fileFindings;
  }

  /**
   * Get analysis report
   */
  getReport() {
    const duration = this.endTime && this.startTime
      ? (this.endTime - this.startTime) / 1000
      : 0;

    // Group findings by severity
    const bySeverity = {};
    for (const severity of Object.keys(SEVERITY_ORDER)) {
      bySeverity[severity] = this.findings.filter(f => f.severity === severity);
    }

    // Group findings by standard
    const byStandard = {};
    for (const finding of this.findings) {
      if (!byStandard[finding.standard]) {
        byStandard[finding.standard] = [];
      }
      byStandard[finding.standard].push(finding);
    }

    // Group findings by category
    const byCategory = {};
    for (const finding of this.findings) {
      if (!byCategory[finding.category]) {
        byCategory[finding.category] = [];
      }
      byCategory[finding.category].push(finding);
    }

    // Group findings by file
    const byFile = {};
    for (const finding of this.findings) {
      if (!byFile[finding.file]) {
        byFile[finding.file] = [];
      }
      byFile[finding.file].push(finding);
    }

    // Calculate compliance score
    const complianceScore = this.calculateComplianceScore();

    return {
      summary: {
        filesAnalyzed: this.filesAnalyzed,
        totalFindings: this.findings.length,
        duration: `${duration.toFixed(2)}s`,
        timestamp: this.startTime?.toISOString(),
        complianceScore
      },
      counts: {
        critical: bySeverity.critical?.length || 0,
        high: bySeverity.high?.length || 0,
        medium: bySeverity.medium?.length || 0,
        low: bySeverity.low?.length || 0,
        info: bySeverity.info?.length || 0
      },
      byStandard,
      byCategory,
      byFile,
      findings: this.findings,
      passed: bySeverity.critical?.length === 0 && bySeverity.high?.length === 0
    };
  }

  /**
   * Calculate a compliance score (0-100)
   */
  calculateComplianceScore() {
    if (this.filesAnalyzed === 0) return 100;

    // Weight findings by severity
    const weights = {
      critical: 25,
      high: 10,
      medium: 3,
      low: 1,
      info: 0.5
    };

    let totalDeductions = 0;
    for (const finding of this.findings) {
      totalDeductions += weights[finding.severity] || 1;
    }

    // Calculate score (max 100, min 0)
    const maxScore = 100;
    const score = Math.max(0, maxScore - totalDeductions);

    return Math.round(score);
  }

  /**
   * Get findings filtered by criteria
   */
  getFindings(filters = {}) {
    let results = [...this.findings];

    if (filters.severity) {
      results = results.filter(f => f.severity === filters.severity);
    }

    if (filters.standard) {
      results = results.filter(f => f.standard === filters.standard);
    }

    if (filters.category) {
      results = results.filter(f => f.category === filters.category);
    }

    if (filters.file) {
      results = results.filter(f => f.file.includes(filters.file));
    }

    if (filters.ruleId) {
      results = results.filter(f => f.ruleId === filters.ruleId);
    }

    return results;
  }

  /**
   * Get unique affected files
   */
  getAffectedFiles() {
    return [...new Set(this.findings.map(f => f.file))];
  }

  /**
   * Get unique rules triggered
   */
  getTriggeredRules() {
    const rules = new Map();
    for (const finding of this.findings) {
      if (!rules.has(finding.ruleId)) {
        rules.set(finding.ruleId, {
          ruleId: finding.ruleId,
          ruleName: finding.ruleName,
          category: finding.category,
          severity: finding.severity,
          standard: finding.standard,
          count: 0
        });
      }
      rules.get(finding.ruleId).count++;
    }
    return Array.from(rules.values()).sort((a, b) =>
      SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    );
  }

  /**
   * Reset analyzer state
   */
  reset() {
    this.findings = [];
    this.filesAnalyzed = 0;
    this.totalFiles = 0;
    this.startTime = null;
    this.endTime = null;
  }
}

/**
 * Quick analysis function
 */
async function analyze(dirPath, options = {}) {
  const analyzer = new ComplianceAnalyzer(options);
  return analyzer.analyzeDirectory(dirPath);
}

/**
 * Get all available categories
 */
function getAllCategories() {
  return {
    HIPAA: Object.values(HIPAA_CATEGORIES),
    SOC2: Object.values(SOC2_CATEGORIES)
  };
}

/**
 * Get all severity levels
 */
function getSeverityLevels() {
  return Object.keys(SEVERITY_ORDER);
}

module.exports = {
  ComplianceAnalyzer,
  analyze,
  getAllCategories,
  getSeverityLevels,
  STANDARDS,
  SEVERITY_ORDER
};
