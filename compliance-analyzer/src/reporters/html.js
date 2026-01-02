/**
 * HTML Reporter
 *
 * Generates a rich HTML compliance report with charts and interactive features.
 */

const fs = require('fs');
const path = require('path');

/**
 * Severity colors for HTML
 */
const severityColors = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
  info: '#6b7280'
};

/**
 * Generate HTML report
 */
function generateHTMLReport(report, options = {}) {
  const { title = 'Compliance Analysis Report' } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%);
      color: white;
      padding: 2rem;
      margin-bottom: 2rem;
      border-radius: 12px;
    }

    header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    header .meta {
      opacity: 0.8;
      font-size: 0.9rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .card h3 {
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 0.5rem;
    }

    .score-card {
      text-align: center;
    }

    .score-value {
      font-size: 4rem;
      font-weight: bold;
    }

    .score-value.good { color: #10b981; }
    .score-value.warning { color: #f59e0b; }
    .score-value.danger { color: #ef4444; }

    .score-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 1rem;
    }

    .score-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .status-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
      margin-top: 1rem;
    }

    .status-badge.passed {
      background: #d1fae5;
      color: #065f46;
    }

    .status-badge.failed {
      background: #fee2e2;
      color: #991b1b;
    }

    .severity-counts {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.5rem;
    }

    .severity-item {
      text-align: center;
      padding: 1rem;
      border-radius: 8px;
    }

    .severity-item .count {
      font-size: 1.5rem;
      font-weight: bold;
    }

    .severity-item .label {
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .severity-critical { background: #fef2f2; color: ${severityColors.critical}; }
    .severity-high { background: #fff7ed; color: ${severityColors.high}; }
    .severity-medium { background: #fefce8; color: ${severityColors.medium}; }
    .severity-low { background: #eff6ff; color: ${severityColors.low}; }
    .severity-info { background: #f9fafb; color: ${severityColors.info}; }

    .findings-section {
      margin-top: 2rem;
    }

    .findings-section h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .filter-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .filter-bar select, .filter-bar input {
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
    }

    .finding {
      background: white;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      margin-bottom: 1rem;
      border-left: 4px solid;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .finding.critical { border-color: ${severityColors.critical}; }
    .finding.high { border-color: ${severityColors.high}; }
    .finding.medium { border-color: ${severityColors.medium}; }
    .finding.low { border-color: ${severityColors.low}; }
    .finding.info { border-color: ${severityColors.info}; }

    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .finding-title {
      font-weight: 600;
      font-size: 1rem;
    }

    .finding-badges {
      display: flex;
      gap: 0.5rem;
    }

    .badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: 500;
    }

    .badge-severity {
      color: white;
    }

    .badge-severity.critical { background: ${severityColors.critical}; }
    .badge-severity.high { background: ${severityColors.high}; }
    .badge-severity.medium { background: ${severityColors.medium}; }
    .badge-severity.low { background: ${severityColors.low}; }
    .badge-severity.info { background: ${severityColors.info}; }

    .badge-standard {
      background: #e5e7eb;
      color: #374151;
    }

    .finding-location {
      font-family: monospace;
      font-size: 0.875rem;
      color: #2563eb;
      margin-bottom: 0.5rem;
    }

    .finding-description {
      color: #4b5563;
      margin-bottom: 0.75rem;
    }

    .finding-code {
      background: #1f2937;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Fira Code', 'Monaco', monospace;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .finding-code .line {
      display: block;
      padding: 0.125rem 0;
    }

    .finding-code .line-number {
      display: inline-block;
      width: 3rem;
      color: #6b7280;
      user-select: none;
    }

    .finding-code .highlight {
      background: rgba(239, 68, 68, 0.3);
    }

    .finding-recommendation {
      background: #f0fdf4;
      border: 1px solid #86efac;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
    }

    .finding-recommendation strong {
      color: #166534;
    }

    .finding-refs {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: #6b7280;
    }

    .charts-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .chart-container {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .bar-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .bar-label {
      width: 100px;
      font-size: 0.875rem;
      text-align: right;
    }

    .bar-container {
      flex: 1;
      height: 24px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 0.5rem;
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      min-width: fit-content;
    }

    footer {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-size: 0.875rem;
    }

    @media (max-width: 768px) {
      .severity-counts {
        grid-template-columns: repeat(3, 1fr);
      }

      .finding-header {
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${title}</h1>
      <div class="meta">
        Generated: ${report.summary.timestamp} | Duration: ${report.summary.duration} | Files Analyzed: ${report.summary.filesAnalyzed}
      </div>
    </header>

    <div class="summary-grid">
      <div class="card score-card">
        <h3>Compliance Score</h3>
        <div class="score-value ${getScoreClass(report.summary.complianceScore)}">${report.summary.complianceScore}</div>
        <div class="score-bar">
          <div class="score-bar-fill" style="width: ${report.summary.complianceScore}%; background: ${getScoreColor(report.summary.complianceScore)};"></div>
        </div>
        <div class="status-badge ${report.passed ? 'passed' : 'failed'}">
          ${report.passed ? 'PASSED' : 'FAILED'}
        </div>
      </div>

      <div class="card">
        <h3>Findings by Severity</h3>
        <div class="severity-counts">
          <div class="severity-item severity-critical">
            <div class="count">${report.counts.critical}</div>
            <div class="label">Critical</div>
          </div>
          <div class="severity-item severity-high">
            <div class="count">${report.counts.high}</div>
            <div class="label">High</div>
          </div>
          <div class="severity-item severity-medium">
            <div class="count">${report.counts.medium}</div>
            <div class="label">Medium</div>
          </div>
          <div class="severity-item severity-low">
            <div class="count">${report.counts.low}</div>
            <div class="label">Low</div>
          </div>
          <div class="severity-item severity-info">
            <div class="count">${report.counts.info}</div>
            <div class="label">Info</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Standards Coverage</h3>
        <div class="bar-chart">
          ${Object.entries(report.byStandard).map(([standard, findings]) => `
            <div class="bar-item">
              <div class="bar-label">${standard}</div>
              <div class="bar-container">
                <div class="bar-fill" style="width: ${getBarWidth(findings.length, report.findings.length)}%; background: ${standard === 'HIPAA' ? '#8b5cf6' : '#06b6d4'};">
                  ${findings.length}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="charts-section">
      <div class="chart-container">
        <h3>Top Categories</h3>
        <div class="bar-chart">
          ${Object.entries(report.byCategory)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 8)
            .map(([category, findings]) => `
              <div class="bar-item">
                <div class="bar-label" style="width: 150px;">${category}</div>
                <div class="bar-container">
                  <div class="bar-fill" style="width: ${getBarWidth(findings.length, report.findings.length)}%; background: #6366f1;">
                    ${findings.length}
                  </div>
                </div>
              </div>
            `).join('')}
        </div>
      </div>

      <div class="chart-container">
        <h3>Most Affected Files</h3>
        <div class="bar-chart">
          ${Object.entries(report.byFile)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 8)
            .map(([file, findings]) => `
              <div class="bar-item">
                <div class="bar-label" style="width: 200px; font-family: monospace; font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis;" title="${file}">
                  ${file.split('/').pop()}
                </div>
                <div class="bar-container">
                  <div class="bar-fill" style="width: ${getBarWidth(findings.length, Math.max(...Object.values(report.byFile).map(f => f.length)))}%; background: #ec4899;">
                    ${findings.length}
                  </div>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    </div>

    <div class="findings-section">
      <h2>All Findings (${report.findings.length})</h2>

      <div class="filter-bar">
        <select id="severityFilter" onchange="filterFindings()">
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <select id="standardFilter" onchange="filterFindings()">
          <option value="">All Standards</option>
          <option value="HIPAA">HIPAA</option>
          <option value="SOC2">SOC2</option>
        </select>
        <input type="text" id="searchFilter" placeholder="Search findings..." oninput="filterFindings()">
      </div>

      <div id="findings-list">
        ${report.findings
          .sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
            return severityOrder[a.severity] - severityOrder[b.severity];
          })
          .map(finding => generateFindingHTML(finding))
          .join('')}
      </div>
    </div>

    <footer>
      <p>Generated by Compliance Code Analyzer v1.0.0</p>
      <p>This report analyzes code for HIPAA and SOC2 compliance indicators. It is not a substitute for a professional compliance audit.</p>
    </footer>
  </div>

  <script>
    function filterFindings() {
      const severity = document.getElementById('severityFilter').value.toLowerCase();
      const standard = document.getElementById('standardFilter').value;
      const search = document.getElementById('searchFilter').value.toLowerCase();

      document.querySelectorAll('.finding').forEach(finding => {
        const matchSeverity = !severity || finding.classList.contains(severity);
        const matchStandard = !standard || finding.dataset.standard === standard;
        const matchSearch = !search || finding.textContent.toLowerCase().includes(search);

        finding.style.display = matchSeverity && matchStandard && matchSearch ? 'block' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Generate HTML for a single finding
 */
function generateFindingHTML(finding) {
  return `
    <div class="finding ${finding.severity}" data-severity="${finding.severity}" data-standard="${finding.standard}">
      <div class="finding-header">
        <div class="finding-title">${finding.ruleId}: ${finding.ruleName}</div>
        <div class="finding-badges">
          <span class="badge badge-severity ${finding.severity}">${finding.severity.toUpperCase()}</span>
          <span class="badge badge-standard">${finding.standard}</span>
        </div>
      </div>
      <div class="finding-location">${finding.file}:${finding.lineNumber}</div>
      <div class="finding-description">${finding.description}</div>
      ${finding.context && finding.context.length > 0 ? `
        <div class="finding-code">
          ${finding.context.map(ctx => `
            <span class="line ${ctx.isMatch ? 'highlight' : ''}">
              <span class="line-number">${ctx.lineNumber}</span>${escapeHTML(ctx.content)}
            </span>
          `).join('')}
        </div>
      ` : ''}
      <div class="finding-recommendation">
        <strong>Recommendation:</strong> ${finding.recommendation}
      </div>
      ${finding.references && finding.references.length > 0 ? `
        <div class="finding-refs">References: ${finding.references.join(', ')}</div>
      ` : ''}
    </div>
  `;
}

/**
 * Get score CSS class
 */
function getScoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'danger';
}

/**
 * Get score color
 */
function getScoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

/**
 * Calculate bar width percentage
 */
function getBarWidth(value, max) {
  if (max === 0) return 0;
  return Math.max(5, (value / max) * 100);
}

/**
 * Escape HTML entities
 */
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Save HTML report to file
 */
function saveHTMLReport(report, filePath, options = {}) {
  const htmlContent = generateHTMLReport(report, options);
  const absolutePath = path.resolve(filePath);
  fs.writeFileSync(absolutePath, htmlContent, 'utf-8');
  return absolutePath;
}

module.exports = {
  generateHTMLReport,
  saveHTMLReport
};
