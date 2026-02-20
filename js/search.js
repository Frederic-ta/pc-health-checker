// Search & Filter — real-time text search and category/severity filtering

/**
 * Filter issues based on search text, categories, and severities.
 * @param {Array<{ severity: string, title: string, detail: string, raw: string, recommendation: string, category: string, parserName: string }>} issues
 * @param {object} filters
 * @param {string} [filters.query] - Text to search for (case-insensitive)
 * @param {string[]} [filters.categories] - Category filter (empty = all)
 * @param {string[]} [filters.severities] - Severity filter (empty = all)
 * @returns {Array} Filtered issues
 */
export function filterIssues(issues, filters = {}) {
  let filtered = issues;

  // Filter by category
  if (filters.categories && filters.categories.length > 0) {
    const cats = new Set(filters.categories.map(c => c.toLowerCase()));
    filtered = filtered.filter(issue => cats.has(issue.category?.toLowerCase()));
  }

  // Filter by severity
  if (filters.severities && filters.severities.length > 0) {
    const sevs = new Set(filters.severities.map(s => s.toLowerCase()));
    filtered = filtered.filter(issue => sevs.has(issue.severity?.toLowerCase()));
  }

  // Text search
  if (filters.query && filters.query.trim().length > 0) {
    const query = filters.query.trim().toLowerCase();
    const terms = query.split(/\s+/);

    filtered = filtered.filter(issue => {
      const searchable = [
        issue.title,
        issue.detail,
        issue.raw,
        issue.recommendation,
        issue.category,
        issue.parserName
      ].filter(Boolean).join(' ').toLowerCase();

      // All terms must match (AND logic)
      return terms.every(term => searchable.includes(term));
    });
  }

  return filtered;
}

/**
 * Get available filter options from current issues.
 * @param {Array} issues
 * @returns {{ categories: string[], severities: string[] }}
 */
export function getFilterOptions(issues) {
  const categories = [...new Set(issues.map(i => i.category).filter(Boolean))];
  const severities = [...new Set(issues.map(i => i.severity).filter(Boolean))];

  // Sort severities in logical order
  const severityOrder = ['critical', 'warning', 'info'];
  severities.sort((a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b));

  return { categories, severities };
}

/**
 * Highlight matching text in a string for display.
 * Returns the string with matching portions wrapped in <mark> tags.
 * @param {string} text - The text to highlight in
 * @param {string} query - The search query
 * @returns {string} HTML string with highlighted matches
 */
export function highlightMatches(text, query) {
  if (!query || !text) return text || '';

  const terms = query.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return text;

  // Escape special regex characters in terms
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

  return text.replace(pattern, '<mark>$1</mark>');
}

/**
 * Get search result summary text.
 * @param {number} filtered - Number of filtered results
 * @param {number} total - Total number of issues
 * @param {string} query - Current search query
 * @returns {string}
 */
export function searchSummary(filtered, total, query) {
  if (!query || query.trim().length === 0) {
    return `${total} issue${total !== 1 ? 's' : ''} found`;
  }
  return `${filtered} of ${total} issue${total !== 1 ? 's' : ''} match "${query}"`;
}

export default { filterIssues, getFilterOptions, highlightMatches, searchSummary };
