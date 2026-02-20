// System Events Parser — wevtutil XML

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.events = {
  name: 'System Events',
  category: 'security',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if ((fn.includes('event') || fn.includes('system')) && (fn.endsWith('.xml') || fn.endsWith('.evtx'))) return true;
    return /<Event\s/i.test(content) && /<System>/i.test(content) && /<Provider/i.test(content);
  },

  parse(content) {
    const issues = [];
    const summary = {};

    // Parse XML events — wevtutil outputs events separated by newlines or concatenated
    const eventBlocks = content.match(/<Event[\s\S]*?<\/Event>/gi) || [];

    if (eventBlocks.length === 0) {
      return {
        summary: { totalEvents: 0 },
        score: 100,
        issues: [{ severity: 'info', title: 'No system events found', detail: 'Could not parse event log data.', raw: '', recommendation: 'Ensure the file was generated with: wevtutil qe System /c:100 /f:xml /rd:true' }]
      };
    }

    const events = [];
    for (const block of eventBlocks) {
      const event = parseEvent(block);
      if (event) events.push(event);
    }

    summary.totalEvents = events.length;

    // Categorize by level
    const critical = events.filter(e => e.level === 1);
    const errors = events.filter(e => e.level === 2);
    const warnings = events.filter(e => e.level === 3);
    const info = events.filter(e => e.level === 4 || e.level === 0);

    summary.critical = critical.length;
    summary.errors = errors.length;
    summary.warnings = warnings.length;
    summary.informational = info.length;

    // Check for BSODs (BugCheck events, Event ID 1001 from BugCheck, or 41 from Kernel-Power)
    const bsodEvents = events.filter(e =>
      /bugcheck/i.test(e.source) ||
      (e.eventId === 1001 && /bugcheck/i.test(e.source)) ||
      (e.eventId === 41 && /kernel-power/i.test(e.source))
    );

    if (bsodEvents.length > 0) {
      issues.push({
        severity: 'critical',
        title: `${bsodEvents.length} BSOD/crash event${bsodEvents.length > 1 ? 's' : ''} detected`,
        detail: `Blue screen or unexpected shutdown events found. Sources: ${[...new Set(bsodEvents.map(e => e.source))].join(', ')}`,
        raw: bsodEvents.slice(0, 3).map(e => `Event ${e.eventId} from ${e.source} at ${e.timeCreated}`).join('\n'),
        recommendation: 'BSODs indicate serious system instability. Check for driver issues, hardware problems, or overheating. Run "sfc /scannow" and check memory with Windows Memory Diagnostic.'
      });
    }

    // Unexpected shutdown (Event ID 6008)
    const unexpectedShutdowns = events.filter(e => e.eventId === 6008);
    if (unexpectedShutdowns.length > 0) {
      issues.push({
        severity: 'warning',
        title: `${unexpectedShutdowns.length} unexpected shutdown${unexpectedShutdowns.length > 1 ? 's' : ''} detected`,
        detail: 'The system shut down unexpectedly (power loss, crash, or forced shutdown).',
        raw: unexpectedShutdowns.slice(0, 3).map(e => `Event 6008 at ${e.timeCreated}`).join('\n'),
        recommendation: 'Check power supply and UPS. If recurring, investigate hardware or driver issues.'
      });
    }

    // Disk errors (Event ID 7, 11, 51, 52 from disk)
    const diskErrors = events.filter(e =>
      /disk/i.test(e.source) && (e.level === 1 || e.level === 2)
    );
    if (diskErrors.length > 0) {
      issues.push({
        severity: 'critical',
        title: `${diskErrors.length} disk error${diskErrors.length > 1 ? 's' : ''} in event log`,
        detail: 'Disk errors can indicate drive failure. Data loss may occur.',
        raw: diskErrors.slice(0, 3).map(e => `Event ${e.eventId} from ${e.source}: ${e.message.substring(0, 100)}`).join('\n'),
        recommendation: 'BACK UP DATA IMMEDIATELY. Run chkdsk /f and check SMART status. Consider replacing the drive.'
      });
    }

    // General critical events
    if (critical.length > 0 && bsodEvents.length === 0 && diskErrors.length === 0) {
      issues.push({
        severity: 'critical',
        title: `${critical.length} critical event${critical.length > 1 ? 's' : ''} in system log`,
        detail: `Critical events from: ${[...new Set(critical.map(e => e.source))].slice(0, 5).join(', ')}`,
        raw: critical.slice(0, 3).map(e => `Event ${e.eventId} from ${e.source} at ${e.timeCreated}`).join('\n'),
        recommendation: 'Investigate critical events in Event Viewer for more details.'
      });
    }

    // Error count assessment
    if (errors.length > 20) {
      issues.push({
        severity: 'warning',
        title: `${errors.length} error events in system log`,
        detail: `High number of error events. Top sources: ${getTopSources(errors, 3).join(', ')}`,
        raw: `Error events: ${errors.length}`,
        recommendation: 'Review error events in Event Viewer. Frequent errors from the same source may indicate a specific problem.'
      });
    } else if (errors.length > 5) {
      issues.push({
        severity: 'info',
        title: `${errors.length} error events in system log`,
        detail: `Sources: ${getTopSources(errors, 3).join(', ')}`,
        raw: `Error events: ${errors.length}`,
        recommendation: 'Some errors are normal. Review if any are recurring from the same source.'
      });
    }

    // Warning assessment
    if (warnings.length > 30) {
      issues.push({
        severity: 'info',
        title: `${warnings.length} warning events in system log`,
        detail: `High number of warnings. Top sources: ${getTopSources(warnings, 3).join(', ')}`,
        raw: `Warning events: ${warnings.length}`,
        recommendation: 'Review recurring warnings for potential issues that haven\'t become errors yet.'
      });
    }

    if (issues.length === 0) {
      issues.push({
        severity: 'info',
        title: `${events.length} system events analyzed — no major issues`,
        detail: `Critical: ${critical.length}, Errors: ${errors.length}, Warnings: ${warnings.length}`,
        raw: '',
        recommendation: 'Event log looks clean.'
      });
    }

    // Score
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 10;
      else if (issue.severity === 'info') score -= 2;
    }
    score = Math.max(0, Math.min(100, score));

    return { summary, score, issues };
  }
};

function parseEvent(xml) {
  try {
    const levelMatch = xml.match(/<Level>(\d+)<\/Level>/i);
    const eventIdMatch = xml.match(/<EventID[^>]*>(\d+)<\/EventID>/i);
    const sourceMatch = xml.match(/<Provider\s+Name='([^']+)'/i) || xml.match(/<Provider\s+Name="([^"]+)"/i);
    const timeMatch = xml.match(/<TimeCreated\s+SystemTime='([^']+)'/i) || xml.match(/<TimeCreated\s+SystemTime="([^"]+)"/i);
    const messageMatch = xml.match(/<Data[^>]*>([^<]*)<\/Data>/i);

    return {
      level: levelMatch ? parseInt(levelMatch[1], 10) : 4,
      eventId: eventIdMatch ? parseInt(eventIdMatch[1], 10) : 0,
      source: sourceMatch ? sourceMatch[1] : 'Unknown',
      timeCreated: timeMatch ? timeMatch[1] : '',
      message: messageMatch ? messageMatch[1] : ''
    };
  } catch {
    return null;
  }
}

function getTopSources(events, n) {
  const counts = {};
  for (const e of events) {
    counts[e.source] = (counts[e.source] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([source, count]) => `${source} (${count})`);
}


})();
