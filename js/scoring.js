// Scoring Engine — calculates category and global health scores

const CATEGORY_WEIGHTS = {
  power: 0.20,
  system: 0.20,
  storage: 0.15,
  network: 0.15,
  security: 0.15,
  performance: 0.15
};

const SEVERITY_PENALTIES = {
  critical: 30,
  warning: 10,
  info: 2
};

/**
 * Calculate a category score from parser results.
 * Starts at 100 and deducts points per issue severity.
 * @param {Array<{ severity: string }>} issues
 * @returns {number} Score 0-100
 */
export function calculateCategoryScore(issues) {
  let score = 100;
  for (const issue of issues) {
    const penalty = SEVERITY_PENALTIES[issue.severity] || 0;
    score -= penalty;
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate all category scores from parsed report results.
 * @param {Array<{ parser: { name: string, category: string }, result: { issues: Array, score: number, summary: object } }>} results
 * @returns {Object} Category scores and global score
 */
export function calculateScores(results) {
  // Group results by category
  const byCategory = {};
  for (const { parser, result } of results) {
    const cat = parser.category;
    if (!byCategory[cat]) {
      byCategory[cat] = { issues: [], parsers: [], summaries: [] };
    }
    byCategory[cat].issues.push(...result.issues);
    byCategory[cat].parsers.push(parser.name);
    byCategory[cat].summaries.push(result.summary);
  }

  // Calculate per-category scores
  const categoryScores = {};
  const allCategories = Object.keys(CATEGORY_WEIGHTS);

  for (const cat of allCategories) {
    if (byCategory[cat]) {
      const score = calculateCategoryScore(byCategory[cat].issues);
      const issueCounts = countBySeverity(byCategory[cat].issues);
      categoryScores[cat] = {
        score,
        hasData: true,
        parsers: byCategory[cat].parsers,
        issues: byCategory[cat].issues,
        issueCounts,
        summaries: byCategory[cat].summaries
      };
    } else {
      categoryScores[cat] = {
        score: null,
        hasData: false,
        parsers: [],
        issues: [],
        issueCounts: { critical: 0, warning: 0, info: 0 },
        summaries: []
      };
    }
  }

  // Calculate weighted global score (only from categories with data)
  let globalScore = 0;
  let totalWeight = 0;

  for (const cat of allCategories) {
    if (categoryScores[cat].hasData) {
      const weight = CATEGORY_WEIGHTS[cat];
      globalScore += categoryScores[cat].score * weight;
      totalWeight += weight;
    }
  }

  // Normalize if not all categories have data
  if (totalWeight > 0) {
    globalScore = Math.round(globalScore / totalWeight);
  } else {
    globalScore = null; // No data at all
  }

  // Collect all issues sorted by severity
  const allIssues = results.flatMap(({ parser, result }) =>
    result.issues.map(issue => ({
      ...issue,
      parserName: parser.name,
      category: parser.category
    }))
  );

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  allIssues.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  // Total issue counts
  const totalIssueCounts = countBySeverity(allIssues);

  return {
    globalScore,
    categoryScores,
    allIssues,
    totalIssueCounts,
    categoriesWithData: Object.keys(byCategory).length,
    totalCategories: allCategories.length
  };
}

/**
 * Get the color for a given score.
 * @param {number|null} score
 * @returns {string} 'green' | 'orange' | 'red' | 'gray'
 */
export function scoreColor(score) {
  if (score === null || score === undefined) return 'gray';
  if (score >= 80) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

/**
 * Get a text label for a given score.
 * @param {number|null} score
 * @returns {string}
 */
export function scoreLabel(score) {
  if (score === null || score === undefined) return 'No Data';
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

function countBySeverity(issues) {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    if (counts[issue.severity] !== undefined) {
      counts[issue.severity]++;
    }
  }
  return counts;
}

export default { calculateScores, calculateCategoryScore, scoreColor, scoreLabel, CATEGORY_WEIGHTS };
