/**
 * SOC2 Compliance Rules
 *
 * SOC2 (Service Organization Control 2) is based on Trust Services Criteria:
 * - Security (Common Criteria)
 * - Availability
 * - Processing Integrity
 * - Confidentiality
 * - Privacy
 */

const { matchPattern, detectHighEntropyStrings } = require('../utils/pattern-matcher');

/**
 * SOC2 Trust Services Categories
 */
const SOC2_CATEGORIES = {
  SECURITY: 'Security',
  AVAILABILITY: 'Availability',
  PROCESSING_INTEGRITY: 'Processing Integrity',
  CONFIDENTIALITY: 'Confidentiality',
  PRIVACY: 'Privacy',
  CHANGE_MANAGEMENT: 'Change Management',
  RISK_MANAGEMENT: 'Risk Management',
  MONITORING: 'Monitoring'
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
 * SOC2 compliance rules
 */
const soc2Rules = [
  // ==================== SECURITY (CC6) ====================
  {
    id: 'SOC2-SEC-001',
    name: 'SQL Injection Vulnerability',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.CRITICAL,
    description: 'Potential SQL injection vulnerability detected',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /query\s*\(\s*['"`].*\$\{/gi,
      /query\s*\(\s*['"`].*\+\s*\w+/gi,
      /execute\s*\(\s*['"`].*\+\s*\w+/gi,
      /\.raw\s*\(\s*['"`].*\$\{/gi,
      /cursor\.execute\s*\(\s*['"].*%s.*['"].*%/gi,
      /sprintf\s*\(\s*['"].*SELECT.*WHERE.*['"].*,/gi,
      /f['"]SELECT.*\{/gi
    ],
    recommendation: 'Use parameterized queries or prepared statements. Never concatenate user input into SQL.',
    references: ['CC6.1', 'OWASP A03:2021']
  },
  {
    id: 'SOC2-SEC-002',
    name: 'Cross-Site Scripting (XSS)',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.HIGH,
    description: 'Potential XSS vulnerability detected',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /innerHTML\s*=\s*(?!['"])/gi,
      /outerHTML\s*=\s*(?!['"])/gi,
      /document\.write\s*\(/gi,
      /\.html\s*\(\s*(?!['"])/gi,
      /dangerouslySetInnerHTML/gi,
      /v-html\s*=/gi,
      /\[innerHTML\]\s*=/gi,
      /\{\{\{.*\}\}\}/g // Unescaped handlebars
    ],
    recommendation: 'Sanitize all user input before rendering. Use textContent instead of innerHTML when possible.',
    references: ['CC6.1', 'OWASP A03:2021']
  },
  {
    id: 'SOC2-SEC-003',
    name: 'Command Injection',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.CRITICAL,
    description: 'Potential command injection vulnerability',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /exec\s*\(\s*['"`].*\$\{/gi,
      /exec\s*\(\s*['"`].*\+/gi,
      /spawn\s*\(\s*['"`].*\$\{/gi,
      /system\s*\(\s*['"`].*\$/gi,
      /subprocess\.call\s*\(\s*['"`].*\+/gi,
      /os\.system\s*\(\s*['"`].*\+/gi,
      /Runtime\.getRuntime\s*\(\s*\)\.exec\s*\(/gi,
      /shell_exec\s*\(\s*\$/gi,
      /eval\s*\(\s*(?!['"])/gi
    ],
    recommendation: 'Never pass unsanitized input to system commands. Use allowlists for permitted commands.',
    references: ['CC6.1', 'OWASP A03:2021']
  },
  {
    id: 'SOC2-SEC-004',
    name: 'Insecure Deserialization',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.HIGH,
    description: 'Potentially unsafe deserialization of user data',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /pickle\.loads?\s*\(/gi,
      /yaml\.load\s*\([^)]*\)(?!.*Loader)/gi,
      /unserialize\s*\(\s*\$/gi,
      /ObjectInputStream\s*\(/gi,
      /JSON\.parse\s*\(\s*(?:req|request)\./gi,
      /marshal\.loads?\s*\(/gi
    ],
    recommendation: 'Validate and sanitize serialized data. Use safe deserialization methods with type checking.',
    references: ['CC6.1', 'OWASP A08:2021']
  },
  {
    id: 'SOC2-SEC-005',
    name: 'Hardcoded Secrets',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.CRITICAL,
    description: 'Secrets or credentials hardcoded in source code',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
      /(?:api_?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /(?:secret|private_?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /(?:access_?token|auth_?token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
      /(?:client_?secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /(?:database_?url|db_?url).*[:=].*:\/\/[^:]+:[^@]+@/gi,
      /PRIVATE KEY-----/gi,
      /Bearer\s+[A-Za-z0-9_\-\.]{20,}/gi,
      /aws_?(?:access_?key|secret)/gi
    ],
    recommendation: 'Use environment variables or a secrets management system. Never commit secrets to version control.',
    references: ['CC6.1', 'CC6.6']
  },
  {
    id: 'SOC2-SEC-006',
    name: 'Weak Cryptography',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.HIGH,
    description: 'Use of weak or deprecated cryptographic algorithms',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /\b(md5|sha1|des|rc4|rc2)\s*\(/gi,
      /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/gi,
      /Cipher\.getInstance\s*\(\s*['"](?:DES|RC4|RC2)['"]/gi,
      /hashlib\.(?:md5|sha1)\s*\(/gi,
      /crypto\.createCipher\s*\(/gi, // Deprecated
      /Math\.random\s*\(\s*\).*(?:token|secret|key|password)/gi
    ],
    recommendation: 'Use AES-256-GCM for encryption, SHA-256+ for hashing, bcrypt/argon2 for passwords.',
    references: ['CC6.1', 'CC6.7']
  },
  {
    id: 'SOC2-SEC-007',
    name: 'Missing CSRF Protection',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.MEDIUM,
    description: 'Forms may lack CSRF token protection',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /<form[^>]*method\s*=\s*['"]?post['"]?[^>]*>(?:(?!csrf|_token|authenticity).)*<\/form>/gis,
      /app\.post\s*\([^)]+\)(?:(?!csrf|csrfProtection).)*$/gim
    ],
    recommendation: 'Implement CSRF tokens for all state-changing requests. Use SameSite cookie attribute.',
    references: ['CC6.1', 'OWASP A01:2021']
  },
  {
    id: 'SOC2-SEC-008',
    name: 'Missing Rate Limiting',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.MEDIUM,
    description: 'Authentication endpoints may lack rate limiting',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /\/(?:login|signin|authenticate|auth)\s*['"],\s*(?:async\s*)?\([^)]*\)\s*=>/gi,
      /app\.post\s*\(\s*['"].*(?:login|auth|password)/gi
    ],
    recommendation: 'Implement rate limiting on authentication endpoints. Use exponential backoff for failed attempts.',
    references: ['CC6.1', 'CC6.6'],
    checkContext: true
  },
  {
    id: 'SOC2-SEC-009',
    name: 'Insecure Cookie Configuration',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.MEDIUM,
    description: 'Cookies may be configured insecurely',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /httpOnly\s*[:=]\s*false/gi,
      /secure\s*[:=]\s*false/gi,
      /sameSite\s*[:=]\s*['"]?none['"]?(?!.*secure)/gi,
      /cookie\s*\([^)]*\)(?!.*(?:httpOnly|secure))/gi
    ],
    recommendation: 'Set httpOnly, secure, and SameSite attributes on sensitive cookies.',
    references: ['CC6.1', 'CC6.7']
  },
  {
    id: 'SOC2-SEC-010',
    name: 'Missing Input Validation',
    category: SOC2_CATEGORIES.SECURITY,
    severity: SEVERITY.MEDIUM,
    description: 'User input may not be validated',
    criteria: 'CC6.1 - Logical and Physical Access Controls',
    patterns: [
      /req\.body\.\w+(?!\s*\?\.|\.trim|\.validate|validator|sanitize)/gi,
      /req\.query\.\w+(?!\s*\?\.|\.trim|parseInt|Number)/gi,
      /req\.params\.\w+(?!\s*\?\.|parseInt|Number|ObjectId)/gi
    ],
    recommendation: 'Validate and sanitize all user input. Use validation libraries like Joi, Yup, or class-validator.',
    references: ['CC6.1'],
    checkContext: true
  },

  // ==================== AVAILABILITY (A1) ====================
  {
    id: 'SOC2-AVL-001',
    name: 'Missing Error Handling',
    category: SOC2_CATEGORIES.AVAILABILITY,
    severity: SEVERITY.MEDIUM,
    description: 'Async operations may lack error handling',
    criteria: 'A1.2 - System Availability',
    patterns: [
      /\.then\s*\([^)]+\)(?!\s*\.catch)/gi,
      /await\s+\w+\s*\([^)]*\)(?!\s*\.catch)(?![^;]*catch)/gi,
      /new\s+Promise\s*\([^)]*\)(?!\s*\.catch)/gi
    ],
    recommendation: 'Implement comprehensive error handling for all async operations. Use try-catch blocks.',
    references: ['A1.2'],
    checkContext: true
  },
  {
    id: 'SOC2-AVL-002',
    name: 'No Health Check Endpoint',
    category: SOC2_CATEGORIES.AVAILABILITY,
    severity: SEVERITY.LOW,
    description: 'Application may lack health check endpoints',
    criteria: 'A1.1 - System Availability',
    patterns: [
      /app\.(get|use)\s*\(\s*['"]\/(health|healthz|ready|alive)['"]/gi
    ],
    recommendation: 'Implement health check endpoints for monitoring and load balancer integration.',
    references: ['A1.1', 'A1.2'],
    checkAbsence: true
  },
  {
    id: 'SOC2-AVL-003',
    name: 'Missing Timeout Configuration',
    category: SOC2_CATEGORIES.AVAILABILITY,
    severity: SEVERITY.MEDIUM,
    description: 'External calls may lack timeout configuration',
    criteria: 'A1.2 - System Availability',
    patterns: [
      /fetch\s*\([^)]+\)(?!.*timeout)/gi,
      /axios\.[a-z]+\s*\([^)]+\)(?!.*timeout)/gi,
      /\.connect\s*\([^)]+\)(?!.*timeout)/gi
    ],
    recommendation: 'Set appropriate timeouts for all external service calls to prevent cascading failures.',
    references: ['A1.2'],
    checkContext: true
  },
  {
    id: 'SOC2-AVL-004',
    name: 'No Circuit Breaker Pattern',
    category: SOC2_CATEGORIES.AVAILABILITY,
    severity: SEVERITY.LOW,
    description: 'External service calls may lack circuit breaker protection',
    criteria: 'A1.2 - System Availability',
    patterns: [
      /(?:circuitBreaker|circuit_breaker|CircuitBreaker)/gi
    ],
    recommendation: 'Implement circuit breaker pattern for external service calls to improve resilience.',
    references: ['A1.2'],
    checkAbsence: true
  },

  // ==================== PROCESSING INTEGRITY (PI1) ====================
  {
    id: 'SOC2-PI-001',
    name: 'Missing Transaction Management',
    category: SOC2_CATEGORIES.PROCESSING_INTEGRITY,
    severity: SEVERITY.MEDIUM,
    description: 'Database operations may lack transaction management',
    criteria: 'PI1.1 - Processing Integrity',
    patterns: [
      /\.save\s*\(\s*\)[^;]*;[^;]*\.save\s*\(\s*\)/gi,
      /\.insert\s*\([^)]+\)[^;]*;[^;]*\.update\s*\(/gi,
      /await\s+\w+\.create\s*\([^)]+\)[^;]*;[^;]*await\s+\w+\.update/gi
    ],
    recommendation: 'Use database transactions for operations that must be atomic. Implement proper rollback handling.',
    references: ['PI1.1', 'PI1.4']
  },
  {
    id: 'SOC2-PI-002',
    name: 'Missing Data Validation',
    category: SOC2_CATEGORIES.PROCESSING_INTEGRITY,
    severity: SEVERITY.MEDIUM,
    description: 'Data may be processed without validation',
    criteria: 'PI1.2 - Processing Integrity',
    patterns: [
      /\.create\s*\(\s*req\.body\s*\)/gi,
      /\.insertOne\s*\(\s*req\.body\s*\)/gi,
      /\.save\s*\(\s*\{[^}]*\.\.\.req\.body/gi,
      /new\s+\w+Model\s*\(\s*req\.body\s*\)/gi
    ],
    recommendation: 'Validate data against schema before processing. Use allowlists for accepted fields.',
    references: ['PI1.2', 'PI1.3']
  },
  {
    id: 'SOC2-PI-003',
    name: 'Race Condition Risk',
    category: SOC2_CATEGORIES.PROCESSING_INTEGRITY,
    severity: SEVERITY.MEDIUM,
    description: 'Code may be susceptible to race conditions',
    criteria: 'PI1.1 - Processing Integrity',
    patterns: [
      /if\s*\([^)]*\.length\s*[<>=]/gi,
      /if\s*\(\s*!\s*\w+\s*\)\s*\{[^}]*\w+\s*=/gi,
      /check.*then.*(?:update|create|delete)/gi
    ],
    recommendation: 'Use atomic operations or proper locking mechanisms to prevent race conditions.',
    references: ['PI1.1'],
    checkContext: true
  },

  // ==================== CONFIDENTIALITY (C1) ====================
  {
    id: 'SOC2-CNF-001',
    name: 'Sensitive Data in Logs',
    category: SOC2_CATEGORIES.CONFIDENTIALITY,
    severity: SEVERITY.HIGH,
    description: 'Sensitive data may be written to logs',
    criteria: 'C1.1 - Confidentiality',
    patterns: [
      /console\.(log|info|warn|error)\s*\([^)]*\b(password|secret|token|key|ssn|credit.?card)\b/gi,
      /logger\.\w+\s*\([^)]*\b(password|secret|token|credit.?card)\b/gi,
      /print\s*\([^)]*\b(password|secret|token)\b/gi,
      /Log\.(d|i|w|e)\s*\([^)]*\b(password|secret|token)\b/gi
    ],
    recommendation: 'Redact sensitive data before logging. Use structured logging with field-level masking.',
    references: ['C1.1', 'C1.2']
  },
  {
    id: 'SOC2-CNF-002',
    name: 'Sensitive Data Exposure in Responses',
    category: SOC2_CATEGORIES.CONFIDENTIALITY,
    severity: SEVERITY.HIGH,
    description: 'API responses may expose sensitive data',
    criteria: 'C1.1 - Confidentiality',
    patterns: [
      /res\.(?:json|send)\s*\(\s*user\s*\)/gi,
      /res\.(?:json|send)\s*\([^)]*password/gi,
      /return\s+\{[^}]*password/gi,
      /\.toJSON\s*=.*password/gi
    ],
    recommendation: 'Use DTOs or explicit field selection. Never return password hashes or secrets in responses.',
    references: ['C1.1', 'C1.2']
  },
  {
    id: 'SOC2-CNF-003',
    name: 'Missing Data Classification',
    category: SOC2_CATEGORIES.CONFIDENTIALITY,
    severity: SEVERITY.LOW,
    description: 'Sensitive data fields may lack classification markers',
    criteria: 'C1.1 - Confidentiality',
    patterns: [
      /(?:ssn|social_?security|credit_?card|card_?number|cvv|password_?hash)/gi
    ],
    recommendation: 'Implement data classification scheme. Mark sensitive fields for proper handling.',
    references: ['C1.1'],
    checkContext: true
  },
  {
    id: 'SOC2-CNF-004',
    name: 'Unencrypted Sensitive Storage',
    category: SOC2_CATEGORIES.CONFIDENTIALITY,
    severity: SEVERITY.HIGH,
    description: 'Sensitive data may be stored without encryption',
    criteria: 'C1.2 - Confidentiality',
    patterns: [
      /localStorage\.setItem\s*\([^)]*(?:token|password|secret|key)/gi,
      /sessionStorage\.setItem\s*\([^)]*(?:token|password|secret)/gi,
      /\.cookie\s*\([^)]*(?:password|secret)/gi,
      /SharedPreferences.*(?:password|token|secret)/gi
    ],
    recommendation: 'Encrypt sensitive data before client-side storage. Use secure storage mechanisms.',
    references: ['C1.2']
  },

  // ==================== PRIVACY (P) ====================
  {
    id: 'SOC2-PRV-001',
    name: 'PII Collection Without Consent Check',
    category: SOC2_CATEGORIES.PRIVACY,
    severity: SEVERITY.MEDIUM,
    description: 'PII may be collected without explicit consent verification',
    criteria: 'P1.1 - Privacy Notice',
    patterns: [
      /(?:email|phone|address|dob|date_?of_?birth|ssn)\s*[:=]\s*req\./gi,
      /collect.*(?:email|phone|personal)/gi
    ],
    recommendation: 'Verify user consent before collecting PII. Implement consent management.',
    references: ['P1.1', 'P2.1'],
    checkContext: true
  },
  {
    id: 'SOC2-PRV-002',
    name: 'Missing Data Anonymization',
    category: SOC2_CATEGORIES.PRIVACY,
    severity: SEVERITY.LOW,
    description: 'Analytics or reporting may use non-anonymized PII',
    criteria: 'P4.1 - Access',
    patterns: [
      /analytics\.track\s*\([^)]*(?:email|name|phone|userId)/gi,
      /trackEvent\s*\([^)]*(?:email|name|userId)/gi,
      /report.*(?:email|name|phone)/gi
    ],
    recommendation: 'Anonymize or pseudonymize PII for analytics and reporting purposes.',
    references: ['P4.1', 'P6.1']
  },
  {
    id: 'SOC2-PRV-003',
    name: 'No Data Retention Policy Implementation',
    category: SOC2_CATEGORIES.PRIVACY,
    severity: SEVERITY.LOW,
    description: 'Data retention/deletion mechanisms may be missing',
    criteria: 'P5.1 - Disposal',
    patterns: [
      /TODO.*(?:retention|delete|purge|gdpr)/gi,
      /FIXME.*(?:retention|cleanup)/gi
    ],
    recommendation: 'Implement automated data retention policies. Provide data deletion capabilities.',
    references: ['P5.1', 'P5.2']
  },

  // ==================== CHANGE MANAGEMENT (CC8) ====================
  {
    id: 'SOC2-CHG-001',
    name: 'Debug Code in Production',
    category: SOC2_CATEGORIES.CHANGE_MANAGEMENT,
    severity: SEVERITY.MEDIUM,
    description: 'Debug code may be present in production',
    criteria: 'CC8.1 - Change Management',
    patterns: [
      /debugger\s*;/gi,
      /console\.log\s*\(\s*['"]DEBUG/gi,
      /\/\/\s*TODO:\s*remove/gi,
      /\/\/\s*HACK/gi,
      /\.only\s*\(\s*['"]/gi // Test .only()
    ],
    recommendation: 'Remove debug code before deployment. Use environment-based logging levels.',
    references: ['CC8.1']
  },
  {
    id: 'SOC2-CHG-002',
    name: 'Hardcoded Environment Configuration',
    category: SOC2_CATEGORIES.CHANGE_MANAGEMENT,
    severity: SEVERITY.MEDIUM,
    description: 'Environment-specific configuration may be hardcoded',
    criteria: 'CC8.1 - Change Management',
    patterns: [
      /(?:baseUrl|apiUrl|endpoint)\s*[:=]\s*['"]https?:\/\/(?!localhost)/gi,
      /port\s*[:=]\s*(?!process\.env)\d{4,5}/gi,
      /host\s*[:=]\s*['"](?!localhost|127\.0\.0\.1)[^'"]+['"]/gi
    ],
    recommendation: 'Use environment variables for configuration. Follow 12-factor app principles.',
    references: ['CC8.1']
  },

  // ==================== MONITORING (CC7) ====================
  {
    id: 'SOC2-MON-001',
    name: 'Missing Error Monitoring',
    category: SOC2_CATEGORIES.MONITORING,
    severity: SEVERITY.MEDIUM,
    description: 'Errors may not be captured for monitoring',
    criteria: 'CC7.2 - System Monitoring',
    patterns: [
      /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/gi, // Empty catch
      /catch\s*\(\s*_\s*\)/gi, // Ignored exception
      /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/gi
    ],
    recommendation: 'Log all errors to monitoring system. Never silently swallow exceptions.',
    references: ['CC7.2', 'CC7.3']
  },
  {
    id: 'SOC2-MON-002',
    name: 'Missing Security Event Logging',
    category: SOC2_CATEGORIES.MONITORING,
    severity: SEVERITY.MEDIUM,
    description: 'Security events may not be logged',
    criteria: 'CC7.2 - System Monitoring',
    patterns: [
      /(?:login|authenticate|authorize).*\{(?:(?!log|audit|track).)*\}/gis
    ],
    recommendation: 'Log all authentication attempts, authorization decisions, and security events.',
    references: ['CC7.2', 'CC7.3'],
    checkContext: true
  },
  {
    id: 'SOC2-MON-003',
    name: 'Missing Access Logging',
    category: SOC2_CATEGORIES.MONITORING,
    severity: SEVERITY.LOW,
    description: 'Data access may not be logged',
    criteria: 'CC7.2 - System Monitoring',
    patterns: [
      /\.find\s*\(\s*\{[^}]*\}\s*\)/gi,
      /SELECT.*FROM/gi,
      /\.get\s*\(\s*['"]\/api\//gi
    ],
    recommendation: 'Implement access logging for sensitive data. Use middleware for consistent logging.',
    references: ['CC7.2'],
    checkContext: true
  },

  // ==================== RISK MANAGEMENT (CC3) ====================
  {
    id: 'SOC2-RSK-001',
    name: 'Disabled Security Features',
    category: SOC2_CATEGORIES.RISK_MANAGEMENT,
    severity: SEVERITY.HIGH,
    description: 'Security features may be disabled',
    criteria: 'CC3.2 - Risk Assessment',
    patterns: [
      /disable.*(?:security|auth|ssl|tls|csrf|xss|cors)/gi,
      /(?:security|auth|ssl|tls|csrf|xss).*(?:false|disabled|off)/gi,
      /helmet\s*\(\s*\{[^}]*(?:false|disabled)/gi,
      /cors\s*\(\s*\{[^}]*origin\s*:\s*(?:true|\*|['"]?\*['"]?)/gi
    ],
    recommendation: 'Never disable security features in production. Document any necessary exceptions.',
    references: ['CC3.2', 'CC6.1']
  },
  {
    id: 'SOC2-RSK-002',
    name: 'Insecure Dependencies Usage',
    category: SOC2_CATEGORIES.RISK_MANAGEMENT,
    severity: SEVERITY.MEDIUM,
    description: 'Code may use patterns associated with vulnerable packages',
    criteria: 'CC3.2 - Risk Assessment',
    patterns: [
      /require\s*\(\s*['"](?:request|node-uuid|underscore\.string)['"]\s*\)/gi,
      /import.*from\s*['"](?:request|node-uuid)['"]/gi,
      /eval\s*\(\s*require/gi
    ],
    recommendation: 'Keep dependencies updated. Use npm audit or Snyk for vulnerability scanning.',
    references: ['CC3.2', 'CC3.4']
  }
];

/**
 * Run all SOC2 rules against file content
 */
function analyzeForSOC2(fileContent, filePath) {
  const findings = [];

  for (const rule of soc2Rules) {
    if (rule.checkAbsence) {
      // For rules that check for absence of patterns
      let found = false;
      for (const pattern of rule.patterns) {
        if (pattern.test(fileContent)) {
          found = true;
          break;
        }
      }
      if (!found && filePath.match(/\.(js|ts|py|java|go)$/)) {
        // Only flag for main source files
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: SEVERITY.INFO,
          description: rule.description,
          recommendation: rule.recommendation,
          references: rule.references,
          criteria: rule.criteria,
          file: filePath,
          lineNumber: 0,
          note: 'Pattern not found in file - may need implementation'
        });
      }
      continue;
    }

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
          criteria: rule.criteria,
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
      ruleId: 'SOC2-SEC-011',
      ruleName: 'Potential Secret Detected (High Entropy)',
      category: SOC2_CATEGORIES.SECURITY,
      severity: SEVERITY.HIGH,
      description: `High-entropy string detected (entropy: ${finding.entropy}). May be a hardcoded secret.`,
      recommendation: 'Verify this is not a secret. Use environment variables or secrets management.',
      references: ['CC6.1', 'CC6.6'],
      criteria: 'CC6.1 - Logical and Physical Access Controls',
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
 * Get all SOC2 rules
 */
function getSOC2Rules() {
  return soc2Rules;
}

/**
 * Get rules by category
 */
function getRulesByCategory(category) {
  return soc2Rules.filter(rule => rule.category === category);
}

/**
 * Get rules by severity
 */
function getRulesBySeverity(severity) {
  return soc2Rules.filter(rule => rule.severity === severity);
}

/**
 * Get rules by criteria
 */
function getRulesByCriteria(criteria) {
  return soc2Rules.filter(rule =>
    rule.criteria && rule.criteria.toLowerCase().includes(criteria.toLowerCase())
  );
}

module.exports = {
  analyzeForSOC2,
  getSOC2Rules,
  getRulesByCategory,
  getRulesBySeverity,
  getRulesByCriteria,
  SOC2_CATEGORIES,
  SEVERITY
};
