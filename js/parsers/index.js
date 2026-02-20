// Parser Registry — collects all parsers from PCHC.parsers, provides auto-detection

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};

  function getAllParsers() {
    var p = window.PCHC.parsers || {};
    return Object.values(p);
  }

  function detectAndParse(filename, content) {
    var allParsers = getAllParsers();
    for (var i = 0; i < allParsers.length; i++) {
      var parser = allParsers[i];
      try {
        if (parser.detect(content, filename)) {
          var result = parser.parse(content);
          return {
            parser: { name: parser.name, category: parser.category },
            result: result
          };
        }
      } catch (err) {
        console.warn('Parser "' + parser.name + '" threw during detect/parse:', err);
        continue;
      }
    }
    return null;
  }

  window.PCHC.detectAndParse = detectAndParse;
  window.PCHC.getAllParsers = getAllParsers;
})();
