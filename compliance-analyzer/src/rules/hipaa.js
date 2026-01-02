/**
 * HIPAA Compliance Rules
 *
 * HIPAA (Health Insurance Portability and Accountability Act) requires
 * protection of Protected Health Information (PHI) through:
 * - Administrative safeguards
 * - Physical safeguards
 * - Technical safeguards
 */

const { matchPattern, matchAnyPattern, detectHighEntropyStrings } = require('../utils/pattern-matcher');

/**
 * Rule categories for HIPAA compliance
 */
const HIPAA_CATEGORIES = {
  PHI_EXPOSURE: 'PHI Exposure',
  ENCRYPTION: 'Encryption',
  ACCESS_CONTROL: 'Access Control',
  AUDIT_LOGGING: 'Audit Logging',
  DATA_TRANSMISSION: 'Data Transmission',
  DATA_STORAGE: 'Data Storage',
  CREDENTIALS: 'Credential Management',
  ERROR_HANDLING: 'Error Handling'
};

/**
 * Severity levels
 */
const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

/**
 * HIPAA compliance rules
 */
const hipaaRules = [
  // ==================== PHI EXPOSURE RULES ====================
  {
    id: 'HIPAA-PHI-001',
    name: 'Potential PHI in Logs',
    category: HIPAA_CATEGORIES.PHI_EXPOSURE,
    severity: SEVERITY.CRITICAL,
    description: 'Logging statements may contain Protected Health Information',
    patterns: [
      /console\.(log|info|warn|error|debug)\s*\([^)]*\b(patient|medical|diagnosis|prescription|ssn|social.?security|health|treatment|medication|doctor|physician)\b/gi,
      /logger\.(log|info|warn|error|debug)\s*\([^)]*\b(patient|medical|diagnosis|prescription|ssn|health|treatment|medication)\b/gi,
      /print\s*\([^)]*\b(patient|medical|diagnosis|prescription|ssn|health|treatment|medication)\b/gi,
      /Log\.(d|i|w|e|v)\s*\([^)]*\b(patient|medical|diagnosis|prescription|ssn|health|treatment)\b/gi
    ],
    recommendation: 'Remove PHI from log statements or implement PHI redaction. Use audit logging for PHI access instead.',
    references: ['45 CFR 164.312(b)', '45 CFR 164.530(j)']
  },
  {
    id: 'HIPAA-PHI-002',
    name: 'PHI in Comments',
    category: HIPAA_CATEGORIES.PHI_EXPOSURE,
    severity: SEVERITY.HIGH,
    description: 'Code comments may contain real PHI examples',
    patterns: [
      /\/\/.*\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern in comments
      /\/\*[\s\S]*?\b\d{3}-\d{2}-\d{4}\b[\s\S]*?\*\//g,
      /#.*\b\d{3}-\d{2}-\d{4}\b/g,
      /\/\/.*\b(patient|ssn|dob|mrn)[:=]\s*\S+/gi
    ],
    recommendation: 'Remove any real PHI from code comments. Use clearly fake data for examples.',
    references: ['45 CFR 164.502(a)']
  },
  {
    id: 'HIPAA-PHI-003',
    name: 'Hardcoded PHI Identifiers',
    category: HIPAA_CATEGORIES.PHI_EXPOSURE,
    severity: SEVERITY.CRITICAL,
    description: 'Hardcoded values that may be PHI identifiers',
    patterns: [
      /(?:mrn|patient_?id|medical_?record)\s*[:=]\s*['"][^'"]+['"]/gi,
      /ssn\s*[:=]\s*['"]?\d{3}-?\d{2}-?\d{4}['"]?/gi,
      /social_?security\s*[:=]\s*['"][^'"]+['"]/gi
    ],
    recommendation: 'Never hardcode PHI identifiers. Use secure configuration or database lookups.',
    references: ['45 CFR 164.312(c)(1)', '45 CFR 164.312(e)(1)']
  },
  {
    id: 'HIPAA-PHI-004',
    name: 'PHI in URL Parameters',
    category: HIPAA_CATEGORIES.PHI_EXPOSURE,
    severity: SEVERITY.HIGH,
    description: 'PHI may be exposed in URL query parameters',
    patterns: [
      /[?&](patient|ssn|dob|mrn|diagnosis|treatment)=/gi,
      /url.*\+.*\b(patient|ssn|dob|mrn)\b/gi,
      /`[^`]*\$\{[^}]*(patient|ssn|mrn)[^}]*\}[^`]*`/gi,
      /encodeURIComponent\s*\([^)]*\b(patient|ssn|mrn|diagnosis)\b/gi
    ],
    recommendation: 'Never pass PHI in URL parameters. Use POST requests with encrypted body or session references.',
    references: ['45 CFR 164.312(e)(1)', '45 CFR 164.312(e)(2)(ii)']
  },

  // ==================== ENCRYPTION RULES ====================
  {
    id: 'HIPAA-ENC-001',
    name: 'Weak Encryption Algorithm',
    category: HIPAA_CATEGORIES.ENCRYPTION,
    severity: SEVERITY.CRITICAL,
    description: 'Use of deprecated or weak encryption algorithms',
    patterns: [
      /\b(md5|sha1|des|rc4|rc2|blowfish)\s*\(/gi,
      /createHash\s*\(\s*['"]?(md5|sha1)['"]?\s*\)/gi,
      /hashlib\.(md5|sha1)\s*\(/gi,
      /MessageDigest\.getInstance\s*\(\s*['"]?(MD5|SHA-1)['"]?\s*\)/gi,
      /Cipher\.getInstance\s*\(\s*['"]?DES['"]?\s*\)/gi
    ],
    recommendation: 'Use AES-256 for encryption and SHA-256 or higher for hashing. Consider using bcrypt/argon2 for passwords.',
    references: ['45 CFR 164.312(a)(2)(iv)', '45 CFR 164.312(e)(2)(ii)']
  },
  {
    id: 'HIPAA-ENC-002',
    name: 'Unencrypted Data Storage',
    category: HIPAA_CATEGORIES.ENCRYPTION,
    severity: SEVERITY.HIGH,
    description: 'PHI may be stored without encryption',
    patterns: [
      /localStorage\.setItem\s*\([^)]*\b(patient|medical|health|ssn|diagnosis)\b/gi,
      /sessionStorage\.setItem\s*\([^)]*\b(patient|medical|health|ssn)\b/gi,
      /\.writeFile\s*\([^)]*\b(patient|medical|health|ssn)\b/gi,
      /fwrite\s*\([^)]*\b(patient|medical|health)\b/gi
    ],
    recommendation: 'Encrypt all PHI before storage. Use encryption at rest for databases and file systems.',
    references: ['45 CFR 164.312(a)(2)(iv)', '45 CFR 164.312(e)(2)(ii)']
  },
  {
    id: 'HIPAA-ENC-003',
    name: 'Hardcoded Encryption Key',
    category: HIPAA_CATEGORIES.ENCRYPTION,
    severity: SEVERITY.CRITICAL,
    description: 'Encryption keys should not be hardcoded',
    patterns: [
      /(?:encryption|secret|aes|crypto)_?key\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /\.encrypt\s*\([^,]+,\s*['"][^'"]{8,}['"]/gi,
      /new\s+SecretKeySpec\s*\([^)]*['"][^'"]+['"]/gi,
      /CryptoJS\.[^.]+\.encrypt\s*\([^,]+,\s*['"][^'"]+['"]/gi
    ],
    recommendation: 'Store encryption keys in secure key management systems (KMS). Never commit keys to source control.',
    references: ['45 CFR 164.312(a)(2)(iv)']
  },
  {
    id: 'HIPAA-ENC-004',
    name: 'Missing HTTPS Enforcement',
    category: HIPAA_CATEGORIES.ENCRYPTION,
    severity: SEVERITY.HIGH,
    description: 'HTTP connections may transmit PHI unencrypted',
    patterns: [
      /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/gi,
      /fetch\s*\(\s*['"]http:\/\/(?!localhost)/gi,
      /axios\.(get|post|put|delete)\s*\(\s*['"]http:\/\/(?!localhost)/gi,
      /requests\.(get|post|put|delete)\s*\(\s*['"]http:\/\//gi
    ],
    recommendation: 'Always use HTTPS for data transmission. Implement HSTS headers.',
    references: ['45 CFR 164.312(e)(1)', '45 CFR 164.312(e)(2)(i)']
  },

  // ==================== ACCESS CONTROL RULES ====================
  {
    id: 'HIPAA-AC-001',
    name: 'Missing Authentication Check',
    category: HIPAA_CATEGORIES.ACCESS_CONTROL,
    severity: SEVERITY.HIGH,
    description: 'API endpoints may lack authentication',
    patterns: [
      /app\.(get|post|put|delete|patch)\s*\([^,]+,\s*(?:async\s*)?\([^)]*\)\s*=>/gi,
      /@(Get|Post|Put|Delete|Patch)Mapping[^@]*public\s+\w+\s+\w+\s*\(/gi,
      /router\.(get|post|put|delete)\s*\([^,]+,\s*(?:async\s*)?\s*\(/gi
    ],
    recommendation: 'Implement authentication middleware for all PHI-related endpoints. Use role-based access control.',
    references: ['45 CFR 164.312(d)', '45 CFR 164.312(a)(1)'],
    checkContext: true // Needs context analysis
  },
  {
    id: 'HIPAA-AC-002',
    name: 'Excessive Permissions',
    category: HIPAA_CATEGORIES.ACCESS_CONTROL,
    severity: SEVERITY.MEDIUM,
    description: 'Overly broad permission grants detected',
    patterns: [
      /chmod\s+777/gi,
      /permission\s*[:=]\s*['"]?\*['"]?/gi,
      /role\s*[:=]\s*['"]?admin['"]?/gi,
      /\*::\*\s*TO\s+/gi, // SQL GRANT
      /allowAll|permitAll|PUBLIC/gi
    ],
    recommendation: 'Follow principle of least privilege. Grant minimum necessary permissions.',
    references: ['45 CFR 164.312(a)(1)', '45 CFR 164.514(d)']
  },
  {
    id: 'HIPAA-AC-003',
    name: 'Missing Session Timeout',
    category: HIPAA_CATEGORIES.ACCESS_CONTROL,
    severity: SEVERITY.MEDIUM,
    description: 'Sessions may not expire, allowing unauthorized access',
    patterns: [
      /session\s*\.\s*cookie\s*\.\s*maxAge\s*[:=]\s*(?:null|undefined|false)/gi,
      /expiresIn\s*[:=]\s*['"]?(?:\d{8,}|never|infinity)['"]?/gi,
      /session_?lifetime\s*[:=]\s*0/gi
    ],
    recommendation: 'Implement automatic session timeout (recommended: 15-30 minutes of inactivity for PHI access).',
    references: ['45 CFR 164.312(a)(2)(iii)']
  },

  // ==================== AUDIT LOGGING RULES ====================
  {
    id: 'HIPAA-AL-001',
    name: 'Missing Audit Logging',
    category: HIPAA_CATEGORIES.AUDIT_LOGGING,
    severity: SEVERITY.HIGH,
    description: 'PHI access may not be logged for audit purposes',
    patterns: [
      /(?:get|fetch|retrieve|query)(?:Patient|Medical|Health|PHI)\s*\(/gi,
      /\.find\s*\(\s*\{\s*(?:patient|medical|ssn)/gi
    ],
    recommendation: 'Implement comprehensive audit logging for all PHI access, modifications, and deletions.',
    references: ['45 CFR 164.312(b)', '45 CFR 164.308(a)(1)(ii)(D)'],
    checkContext: true
  },
  {
    id: 'HIPAA-AL-002',
    name: 'Insufficient Audit Details',
    category: HIPAA_CATEGORIES.AUDIT_LOGGING,
    severity: SEVERITY.MEDIUM,
    description: 'Audit logs may lack required details (who, what, when)',
    patterns: [
      /audit\s*\(\s*['"][^'"]*['"]\s*\)/gi,
      /logAccess\s*\(\s*\w+\s*\)/gi
    ],
    recommendation: 'Audit logs must include: user identity, timestamp, action performed, data accessed, and outcome.',
    references: ['45 CFR 164.312(b)', '45 CFR 164.308(a)(1)(ii)(D)']
  },

  // ==================== DATA TRANSMISSION RULES ====================
  {
    id: 'HIPAA-DT-001',
    name: 'Insecure Data Transmission',
    category: HIPAA_CATEGORIES.DATA_TRANSMISSION,
    severity: SEVERITY.CRITICAL,
    description: 'PHI may be transmitted insecurely',
    patterns: [
      /ftp:\/\//gi,
      /telnet:\/\//gi,
      /smtp(?!s):\/\//gi,
      /rejectUnauthorized\s*[:=]\s*false/gi,
      /NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"]?0['"]?/gi,
      /verify\s*[:=]\s*false.*ssl/gi,
      /ssl_verify\s*[:=]\s*false/gi
    ],
    recommendation: 'Use encrypted protocols (HTTPS, SFTP, TLS). Never disable certificate verification in production.',
    references: ['45 CFR 164.312(e)(1)', '45 CFR 164.312(e)(2)(ii)']
  },
  {
    id: 'HIPAA-DT-002',
    name: 'Email PHI Without Encryption',
    category: HIPAA_CATEGORIES.DATA_TRANSMISSION,
    severity: SEVERITY.HIGH,
    description: 'PHI may be sent via unencrypted email',
    patterns: [
      /sendMail\s*\([^)]*\b(patient|medical|diagnosis|ssn|health)\b/gi,
      /nodemailer.*\b(patient|medical|ssn)\b/gi,
      /mail\s*\(.*\b(patient|medical|ssn)\b/gi,
      /smtp.*send.*\b(patient|medical|health)\b/gi
    ],
    recommendation: 'Encrypt all emails containing PHI. Use secure messaging platforms or encrypted email solutions.',
    references: ['45 CFR 164.312(e)(2)(ii)']
  },

  // ==================== DATA STORAGE RULES ====================
  {
    id: 'HIPAA-DS-001',
    name: 'Unencrypted Database Connection',
    category: HIPAA_CATEGORIES.DATA_STORAGE,
    severity: SEVERITY.HIGH,
    description: 'Database connections may not use encryption',
    patterns: [
      /mongodb:\/\/(?!.*ssl=true)/gi,
      /mysql:\/\/(?!.*ssl)/gi,
      /postgresql:\/\/(?!.*sslmode=require)/gi,
      /sslmode\s*[:=]\s*['"]?disable['"]?/gi,
      /useSSL\s*[:=]\s*false/gi
    ],
    recommendation: 'Enable SSL/TLS for all database connections. Use encrypted connections in production.',
    references: ['45 CFR 164.312(e)(2)(ii)']
  },
  {
    id: 'HIPAA-DS-002',
    name: 'PHI in Temporary Files',
    category: HIPAA_CATEGORIES.DATA_STORAGE,
    severity: SEVERITY.MEDIUM,
    description: 'PHI may be written to temporary files without encryption',
    patterns: [
      /(?:tmp|temp|\/tmp\/).*\b(patient|medical|health|phi)\b/gi,
      /tempfile.*\b(patient|medical|health)\b/gi,
      /createTempFile.*\b(patient|medical)\b/gi
    ],
    recommendation: 'Encrypt temporary files containing PHI and ensure secure deletion after use.',
    references: ['45 CFR 164.312(a)(2)(iv)']
  },
  {
    id: 'HIPAA-DS-003',
    name: 'Missing Data Retention Policy',
    category: HIPAA_CATEGORIES.DATA_STORAGE,
    severity: SEVERITY.LOW,
    description: 'No data retention/deletion mechanism detected',
    patterns: [
      /TODO.*retention/gi,
      /FIXME.*delete.*old/gi
    ],
    recommendation: 'Implement data retention policies. HIPAA requires retention for 6 years from creation or last effective date.',
    references: ['45 CFR 164.530(j)']
  },

  // ==================== CREDENTIAL MANAGEMENT RULES ====================
  {
    id: 'HIPAA-CM-001',
    name: 'Hardcoded Credentials',
    category: HIPAA_CATEGORIES.CREDENTIALS,
    severity: SEVERITY.CRITICAL,
    description: 'Credentials are hardcoded in source code',
    patterns: [
      /password\s*[:=]\s*['"][^'"]{4,}['"]/gi,
      /api_?key\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /secret\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /token\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
      /auth.*[:=]\s*['"][^'"]{8,}['"]/gi,
      /credentials\s*[:=]\s*\{[^}]*password/gi
    ],
    recommendation: 'Use environment variables or secure secret management (HashiCorp Vault, AWS Secrets Manager).',
    references: ['45 CFR 164.312(d)']
  },
  {
    id: 'HIPAA-CM-002',
    name: 'Weak Password Policy',
    category: HIPAA_CATEGORIES.CREDENTIALS,
    severity: SEVERITY.MEDIUM,
    description: 'Password validation may be too weak',
    patterns: [
      /password.*\.length\s*>=?\s*[1-7]\b/gi,
      /minLength\s*[:=]\s*[1-7]\b/gi,
      /password.*\.test\s*\(\s*\/\^\.{4,7}\$/gi
    ],
    recommendation: 'Enforce strong password policy: minimum 12 characters, complexity requirements, no common passwords.',
    references: ['45 CFR 164.308(a)(5)(ii)(D)']
  },

  // ==================== ERROR HANDLING RULES ====================
  {
    id: 'HIPAA-EH-001',
    name: 'PHI in Error Messages',
    category: HIPAA_CATEGORIES.ERROR_HANDLING,
    severity: SEVERITY.HIGH,
    description: 'Error messages may expose PHI',
    patterns: [
      /catch\s*\([^)]*\)\s*\{[^}]*\b(patient|ssn|medical)\b[^}]*\}/gi,
      /throw\s+new\s+Error\s*\([^)]*\b(patient|ssn|medical)\b/gi,
      /res\.(status|json|send)\s*\([^)]*\b(patient|ssn|medical)\b/gi
    ],
    recommendation: 'Never expose PHI in error messages. Log detailed errors server-side, return generic messages to users.',
    references: ['45 CFR 164.502(a)']
  },
  {
    id: 'HIPAA-EH-002',
    name: 'Verbose Error Responses',
    category: HIPAA_CATEGORIES.ERROR_HANDLING,
    severity: SEVERITY.MEDIUM,
    description: 'Detailed error information may be exposed to clients',
    patterns: [
      /res\.send\s*\(\s*(?:err|error)\.(?:stack|message)\s*\)/gi,
      /\.status\s*\(\s*500\s*\)\.json\s*\(\s*\{[^}]*stack/gi,
      /DEBUG\s*[:=]\s*(?:true|1|['"]true['"])/gi,
      /app\.use\s*\([^)]*errorhandler\s*\(\s*\)/gi
    ],
    recommendation: 'Disable detailed error messages in production. Use generic error responses for clients.',
    references: ['45 CFR 164.312(e)(2)(i)']
  }
];

/**
 * Run all HIPAA rules against file content
 */
function analyzeForHIPAA(fileContent, filePath) {
  const findings = [];

  for (const rule of hipaaRules) {
    for (const pattern of rule.patterns) {
      const matches = matchPattern(fileContent, pattern);

      for (const match of matches) {
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          recommendation: rule.recommendation,
          references: rule.references,
          file: filePath,
          lineNumber: match.lineNumber,
          column: match.column,
          matchedText: match.matchedText,
          line: match.line,
          context: match.context
        });
      }
    }
  }

  // Check for high-entropy strings (potential secrets)
  const entropyFindings = detectHighEntropyStrings(fileContent);
  for (const finding of entropyFindings) {
    findings.push({
      ruleId: 'HIPAA-CM-003',
      ruleName: 'Potential Secret Detected',
      category: HIPAA_CATEGORIES.CREDENTIALS,
      severity: SEVERITY.HIGH,
      description: `High-entropy string detected (entropy: ${finding.entropy}). May be a hardcoded secret.`,
      recommendation: 'Verify this is not a secret. If it is, move to secure configuration.',
      references: ['45 CFR 164.312(d)'],
      file: filePath,
      lineNumber: finding.lineNumber,
      column: finding.column,
      matchedText: finding.preview,
      context: finding.context
    });
  }

  return findings;
}

/**
 * Get all HIPAA rules
 */
function getHIPAARules() {
  return hipaaRules;
}

/**
 * Get rules by category
 */
function getRulesByCategory(category) {
  return hipaaRules.filter(rule => rule.category === category);
}

/**
 * Get rules by severity
 */
function getRulesBySeverity(severity) {
  return hipaaRules.filter(rule => rule.severity === severity);
}

module.exports = {
  analyzeForHIPAA,
  getHIPAARules,
  getRulesByCategory,
  getRulesBySeverity,
  HIPAA_CATEGORIES,
  SEVERITY
};
