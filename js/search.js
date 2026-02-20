// Search & Filter

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};

  function filterIssues(issues, filters) {
    filters = filters || {};
    var filtered = issues;

    if (filters.categories && filters.categories.length > 0) {
      var cats = {};
      filters.categories.forEach(function(c) { cats[c.toLowerCase()] = true; });
      filtered = filtered.filter(function(issue) { return cats[(issue.category || '').toLowerCase()]; });
    }

    if (filters.severities && filters.severities.length > 0) {
      var sevs = {};
      filters.severities.forEach(function(s) { sevs[s.toLowerCase()] = true; });
      filtered = filtered.filter(function(issue) { return sevs[(issue.severity || '').toLowerCase()]; });
    }

    if (filters.query && filters.query.trim().length > 0) {
      var terms = filters.query.trim().toLowerCase().split(/\s+/);
      filtered = filtered.filter(function(issue) {
        var searchable = [issue.title, issue.detail, issue.raw, issue.recommendation, issue.category, issue.parserName]
          .filter(Boolean).join(' ').toLowerCase();
        return terms.every(function(term) { return searchable.indexOf(term) !== -1; });
      });
    }

    return filtered;
  }

  window.PCHC.filterIssues = filterIssues;
})();
