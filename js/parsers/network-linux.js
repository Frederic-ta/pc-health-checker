// Network Linux Parser — ip addr / ss output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.networkLinux = {
    name: 'Network (Linux)',
    category: 'network',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('network-linux') || fn === 'ip-addr.txt') return true;
      // ip addr output has lines like "1: lo: <LOOPBACK ..."
      // ss output has "State" "Recv-Q" headers
      return /^\d+:\s+\S+:\s+</.m.test(content) ||
             (/inet\s+\d+\.\d+/m.test(content) && /BROADCAST|LOOPBACK|MULTICAST/i.test(content));
    },

    parse(content) {
      var issues = [];
      var summary = { interfaces: [], connections: 0 };

      // Split ip addr section from ss section
      var parts = content.split(/---SS---/i);
      var ipSection = parts[0] || content;
      var ssSection = parts[1] || '';

      // Parse ip addr output
      var ifaceBlocks = ipSection.split(/(?=^\d+:\s)/m);

      for (var i = 0; i < ifaceBlocks.length; i++) {
        var block = ifaceBlocks[i].trim();
        if (!block) continue;

        var nameMatch = block.match(/^\d+:\s+(\S+):\s+<([^>]*)>/);
        if (!nameMatch) continue;

        var ifName = nameMatch[1];
        var flags = nameMatch[2];
        var isUp = /\bUP\b/.test(flags);
        var isLoopback = /\bLOOPBACK\b/.test(flags);

        // Get IPv4 address
        var ipv4Match = block.match(/inet\s+([\d.]+)\/(\d+)/);
        var ipv4 = ipv4Match ? ipv4Match[1] : null;

        // Get IPv6
        var ipv6Match = block.match(/inet6\s+([\da-f:]+)\/(\d+)/);

        // Get MAC
        var macMatch = block.match(/link\/ether\s+([\da-f:]+)/i);

        // Get state
        var stateMatch = block.match(/state\s+(\S+)/);
        var state = stateMatch ? stateMatch[1] : (isUp ? 'UP' : 'DOWN');

        var iface = {
          name: ifName,
          state: state,
          ip: ipv4,
          loopback: isLoopback,
          mac: macMatch ? macMatch[1] : null
        };

        summary.interfaces.push(iface);

        // Issue: non-loopback interface down
        if (!isLoopback && state === 'DOWN') {
          issues.push({
            severity: 'warning',
            title: 'Network interface ' + ifName + ' is DOWN',
            detail: 'Interface ' + ifName + ' is not active.',
            raw: block.substring(0, 200),
            recommendation: 'Bring it up with: sudo ip link set ' + ifName + ' up'
          });
        }

        // Issue: non-loopback interface with no IP
        if (!isLoopback && isUp && !ipv4 && state !== 'DOWN') {
          issues.push({
            severity: 'warning',
            title: 'Interface ' + ifName + ' has no IPv4 address',
            detail: 'The interface is up but has no IP address assigned.',
            raw: 'Interface: ' + ifName + ' | State: ' + state,
            recommendation: 'Check DHCP or configure a static IP address.'
          });
        }
      }

      // Parse ss output for connections
      if (ssSection) {
        var ssLines = ssSection.trim().split('\n');
        var listenCount = 0;
        var establishedCount = 0;

        for (var j = 0; j < ssLines.length; j++) {
          var line = ssLines[j];
          if (/^LISTEN/i.test(line)) listenCount++;
          if (/^ESTAB/i.test(line)) establishedCount++;
        }

        summary.listeningPorts = listenCount;
        summary.establishedConnections = establishedCount;
        summary.connections = listenCount + establishedCount;

        if (listenCount > 50) {
          issues.push({
            severity: 'info',
            title: listenCount + ' listening ports detected',
            detail: 'A high number of services are listening for incoming connections.',
            raw: 'Listening: ' + listenCount + ' | Established: ' + establishedCount,
            recommendation: 'Review listening services: ss -tulnp. Disable unnecessary services.'
          });
        }
      }

      // Check if we have any non-loopback active interfaces
      var activeNonLo = summary.interfaces.filter(function(iface) {
        return !iface.loopback && iface.ip;
      });
      if (activeNonLo.length === 0 && summary.interfaces.length > 0) {
        issues.push({
          severity: 'critical',
          title: 'No active network connection detected',
          detail: 'No non-loopback interface has an IP address assigned.',
          raw: 'Interfaces: ' + summary.interfaces.map(function(i) { return i.name + '(' + i.state + ')'; }).join(', '),
          recommendation: 'Check network cables, WiFi connection, or DHCP configuration.'
        });
      }

      summary.adapters = activeNonLo.map(function(iface) {
        return { name: iface.name, ip: iface.ip };
      });

      var score = 100;
      for (var k = 0; k < issues.length; k++) {
        if (issues[k].severity === 'critical') score -= 30;
        else if (issues[k].severity === 'warning') score -= 10;
        else if (issues[k].severity === 'info') score -= 2;
      }
      score = Math.max(0, Math.min(100, score));

      if (issues.length === 0) {
        issues.push({
          severity: 'info',
          title: 'Network configuration looks good',
          detail: activeNonLo.length + ' active interface(s) with IP addresses.',
          raw: activeNonLo.map(function(i) { return i.name + ': ' + i.ip; }).join(', '),
          recommendation: 'No action needed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
