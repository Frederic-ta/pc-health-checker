// Scoring Engine — calculates category and global health scores

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};

  var CATEGORY_WEIGHTS = {
    power: 0.20, system: 0.20, storage: 0.15,
    network: 0.15, security: 0.15, performance: 0.15
  };

  var SEVERITY_PENALTIES = { critical: 30, warning: 10, info: 2 };

  function calculateCategoryScore(issues) {
    var score = 100;
    for (var i = 0; i < issues.length; i++) {
      score -= (SEVERITY_PENALTIES[issues[i].severity] || 0);
    }
    return Math.max(0, Math.min(100, score));
  }

  function countBySeverity(issues) {
    var counts = { critical: 0, warning: 0, info: 0 };
    for (var i = 0; i < issues.length; i++) {
      if (counts[issues[i].severity] !== undefined) counts[issues[i].severity]++;
    }
    return counts;
  }

  function calculateScores(results) {
    var byCategory = {};
    for (var i = 0; i < results.length; i++) {
      var parser = results[i].parser, result = results[i].result;
      var cat = parser.category;
      if (!byCategory[cat]) byCategory[cat] = { issues: [], parsers: [], summaries: [] };
      byCategory[cat].issues = byCategory[cat].issues.concat(result.issues);
      byCategory[cat].parsers.push(parser.name);
      byCategory[cat].summaries.push(result.summary);
    }

    var allCategories = Object.keys(CATEGORY_WEIGHTS);
    var categoryScores = {};

    for (var c = 0; c < allCategories.length; c++) {
      var catKey = allCategories[c];
      if (byCategory[catKey]) {
        var score = calculateCategoryScore(byCategory[catKey].issues);
        categoryScores[catKey] = {
          score: score, hasData: true,
          parsers: byCategory[catKey].parsers,
          issues: byCategory[catKey].issues,
          issueCounts: countBySeverity(byCategory[catKey].issues),
          summaries: byCategory[catKey].summaries
        };
      } else {
        categoryScores[catKey] = {
          score: null, hasData: false, parsers: [], issues: [],
          issueCounts: { critical: 0, warning: 0, info: 0 }, summaries: []
        };
      }
    }

    var globalScore = 0, totalWeight = 0;
    for (var w = 0; w < allCategories.length; w++) {
      var ck = allCategories[w];
      if (categoryScores[ck].hasData) {
        globalScore += categoryScores[ck].score * CATEGORY_WEIGHTS[ck];
        totalWeight += CATEGORY_WEIGHTS[ck];
      }
    }
    globalScore = totalWeight > 0 ? Math.round(globalScore / totalWeight) : null;

    var allIssues = [];
    for (var r = 0; r < results.length; r++) {
      var p = results[r].parser, res = results[r].result;
      for (var j = 0; j < res.issues.length; j++) {
        var issue = Object.assign({}, res.issues[j], { parserName: p.name, category: p.category });
        allIssues.push(issue);
      }
    }
    var severityOrder = { critical: 0, warning: 1, info: 2 };
    allIssues.sort(function(a, b) {
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });

    return {
      globalScore: globalScore, categoryScores: categoryScores, allIssues: allIssues,
      totalIssueCounts: countBySeverity(allIssues),
      categoriesWithData: Object.keys(byCategory).length,
      totalCategories: allCategories.length
    };
  }

  window.PCHC.calculateScores = calculateScores;
})();
