# Compliance Code Analyzer

A static analysis tool that scans source code for HIPAA and SOC2 compliance violations. Identify security vulnerabilities, data handling issues, and compliance risks before they become problems.

## Features

- **HIPAA Compliance Checks**: PHI exposure, encryption, access control, audit logging, data transmission security
- **SOC2 Compliance Checks**: Security (CC6), Availability (A1), Processing Integrity (PI1), Confidentiality (C1), Privacy (P)
- **Multiple Output Formats**: Console, JSON, SARIF (GitHub Code Scanning compatible), HTML
- **Configurable Severity Thresholds**: Filter by critical, high, medium, low, or info
- **Rule Customization**: Include/exclude specific rules
- **High-Entropy Secret Detection**: Automatically detect potential hardcoded secrets
- **CI/CD Integration**: Exit codes for pipeline integration

## Installation

```bash
# Clone the repository
cd compliance-analyzer

# Install dependencies
npm install

# Make CLI executable (optional)
chmod +x src/index.js
npm link
```

## Quick Start

```bash
# Analyze current directory
node src/index.js .

# Analyze specific directory
node src/index.js ./my-project/src

# Generate HTML report
node src/index.js --output html --report report.html ./src

# Check only HIPAA compliance
node src/index.js --standard hipaa ./src

# Check only high severity and above
node src/index.js --severity high ./src
```

## CLI Options

```
Usage: compliance-analyzer [options] <directory>

Options:
  -h, --help              Show help message
  -v, --version           Show version number
  -s, --standard <name>   Compliance standard: hipaa, soc2, all (default: all)
  -o, --output <format>   Output format: console, json, sarif, html (default: console)
  -r, --report <file>     Save report to file
  --severity <level>      Minimum severity: critical, high, medium, low, info
  --exclude <rules>       Comma-separated rule IDs to exclude
  --include <rules>       Comma-separated rule IDs to include (only these)
  --ignore <patterns>     Additional patterns to ignore
  --no-context            Don't show code context
  --compact               Compact output format
  --limit <n>             Limit findings shown
  -q, --quiet             Suppress progress output
  --fail-on-error         Exit code 1 if critical/high issues found
```

## Programmatic Usage

```javascript
const { ComplianceAnalyzer, STANDARDS } = require('./src/index');

// Create analyzer with options
const analyzer = new ComplianceAnalyzer({
  standards: [STANDARDS.HIPAA, STANDARDS.SOC2],
  severityThreshold: 'medium',
  excludeRules: ['HIPAA-PHI-004'],
  ignorePatterns: ['test/**', '*.test.js']
});

// Run analysis
const report = await analyzer.analyzeDirectory('./src');

// Access results
console.log(`Score: ${report.summary.complianceScore}/100`);
console.log(`Total findings: ${report.summary.totalFindings}`);
console.log(`Critical: ${report.counts.critical}`);
console.log(`Passed: ${report.passed}`);

// Filter findings
const criticalIssues = analyzer.getFindings({ severity: 'critical' });
const hipaaIssues = analyzer.getFindings({ standard: 'HIPAA' });
```

## HIPAA Rules

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| HIPAA-PHI-001 | PHI in Logs | Critical | Logging statements containing PHI |
| HIPAA-PHI-002 | PHI in Comments | High | Code comments with real PHI examples |
| HIPAA-PHI-003 | Hardcoded PHI | Critical | Hardcoded PHI identifiers |
| HIPAA-PHI-004 | PHI in URLs | High | PHI exposed in URL parameters |
| HIPAA-ENC-001 | Weak Encryption | Critical | Deprecated encryption algorithms |
| HIPAA-ENC-002 | Unencrypted Storage | High | PHI stored without encryption |
| HIPAA-ENC-003 | Hardcoded Keys | Critical | Encryption keys in source code |
| HIPAA-ENC-004 | Missing HTTPS | High | HTTP instead of HTTPS |
| HIPAA-AC-001 | Missing Auth | High | Endpoints without authentication |
| HIPAA-AC-002 | Excessive Permissions | Medium | Overly broad permission grants |
| HIPAA-AC-003 | Missing Session Timeout | Medium | Sessions without expiration |
| HIPAA-AL-001 | Missing Audit Logging | High | PHI access not logged |
| HIPAA-DT-001 | Insecure Transmission | Critical | Unencrypted data transmission |
| HIPAA-CM-001 | Hardcoded Credentials | Critical | Passwords in source code |
| HIPAA-EH-001 | PHI in Errors | High | PHI exposed in error messages |

## SOC2 Rules

| Rule ID | Name | Criteria | Severity |
|---------|------|----------|----------|
| SOC2-SEC-001 | SQL Injection | CC6.1 | Critical |
| SOC2-SEC-002 | XSS Vulnerability | CC6.1 | High |
| SOC2-SEC-003 | Command Injection | CC6.1 | Critical |
| SOC2-SEC-004 | Insecure Deserialization | CC6.1 | High |
| SOC2-SEC-005 | Hardcoded Secrets | CC6.1 | Critical |
| SOC2-SEC-006 | Weak Cryptography | CC6.1 | High |
| SOC2-SEC-007 | Missing CSRF Protection | CC6.1 | Medium |
| SOC2-SEC-008 | Missing Rate Limiting | CC6.1 | Medium |
| SOC2-SEC-009 | Insecure Cookies | CC6.1 | Medium |
| SOC2-AVL-001 | Missing Error Handling | A1.2 | Medium |
| SOC2-AVL-003 | Missing Timeouts | A1.2 | Medium |
| SOC2-PI-001 | Missing Transactions | PI1.1 | Medium |
| SOC2-PI-002 | Missing Data Validation | PI1.2 | Medium |
| SOC2-CNF-001 | Sensitive Data in Logs | C1.1 | High |
| SOC2-CNF-002 | Data Exposure in Responses | C1.1 | High |
| SOC2-PRV-001 | PII Without Consent | P1.1 | Medium |
| SOC2-CHG-001 | Debug Code | CC8.1 | Medium |
| SOC2-MON-001 | Missing Error Monitoring | CC7.2 | Medium |
| SOC2-RSK-001 | Disabled Security | CC3.2 | High |

## Output Formats

### Console Output
Default output with color-coded findings, code context, and recommendations.

### JSON Output
```bash
node src/index.js --output json --report findings.json ./src
```

### SARIF Output
Compatible with GitHub Code Scanning, VS Code, and other SARIF-compatible tools.
```bash
node src/index.js --output sarif --report results.sarif ./src
```

### HTML Report
Rich, interactive HTML report with charts and filtering.
```bash
node src/index.js --output html --report report.html ./src
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Compliance Check

on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Compliance Analyzer
        run: |
          cd compliance-analyzer
          npm install

      - name: Run Compliance Analysis
        run: |
          cd compliance-analyzer
          node src/index.js --output sarif --report ../results.sarif --fail-on-error ../src

      - name: Upload SARIF results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

### GitLab CI

```yaml
compliance-check:
  image: node:20
  script:
    - cd compliance-analyzer && npm install
    - node src/index.js --output json --report report.json --fail-on-error ../src
  artifacts:
    reports:
      codequality: compliance-analyzer/report.json
```

## Compliance Score

The compliance score (0-100) is calculated based on finding severity:
- **Critical**: -25 points each
- **High**: -10 points each
- **Medium**: -3 points each
- **Low**: -1 point each
- **Info**: -0.5 points each

### Pass/Fail Criteria
- **PASSED**: No critical or high severity findings
- **FAILED**: One or more critical or high severity findings

## Supported Languages

The analyzer scans files with these extensions:
- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- Python: `.py`, `.pyw`
- Java: `.java`
- C#: `.cs`
- Go: `.go`
- Ruby: `.rb`
- PHP: `.php`
- Swift: `.swift`
- Kotlin: `.kt`, `.kts`
- Rust: `.rs`
- C/C++: `.c`, `.cpp`, `.cc`, `.h`, `.hpp`
- SQL: `.sql`
- Shell: `.sh`, `.bash`
- Config: `.yml`, `.yaml`, `.json`, `.xml`, `.env`, `.ini`, `.tf`

## Limitations

This tool performs static pattern matching and cannot:
- Detect runtime-only vulnerabilities
- Validate actual encryption implementation
- Verify access control logic
- Replace professional security audits
- Guarantee compliance

Always combine automated scanning with manual code review and professional compliance assessment.

## License

MIT License
