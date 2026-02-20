// Network Config Parser — ipconfig /all TXT

export default {
  name: 'Network Config',
  category: 'network',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if ((fn.includes('ipconfig') || fn.includes('network')) && fn.endsWith('.txt')) return true;
    return /Windows IP Configuration/i.test(content) ||
           (/IPv4 Address/i.test(content) && /Subnet Mask/i.test(content) && /Default Gateway/i.test(content));
  },

  parse(content) {
    const issues = [];
    const summary = {};

    // Parse adapters
    const adapterBlocks = content.split(/(?:Ethernet adapter|Wireless LAN adapter|Unknown adapter)\s+/i);
    const adapters = [];

    for (let i = 1; i < adapterBlocks.length; i++) {
      const block = adapterBlocks[i];
      const nameMatch = block.match(/^([^:]+):/);
      const adapter = {
        name: nameMatch ? nameMatch[1].trim() : `Adapter ${i}`,
        connected: !/Media disconnected/i.test(block),
        ipv4: extractField(block, 'IPv4 Address'),
        ipv6: extractField(block, 'IPv6 Address') || extractField(block, 'Link-local IPv6'),
        subnetMask: extractField(block, 'Subnet Mask'),
        gateway: extractField(block, 'Default Gateway'),
        dns: extractAllFields(block, 'DNS Servers'),
        dhcp: extractField(block, 'DHCP Enabled'),
        dhcpServer: extractField(block, 'DHCP Server'),
        macAddress: extractField(block, 'Physical Address'),
        description: extractField(block, 'Description')
      };

      // Clean up IP addresses (remove parenthetical notes like "(Preferred)")
      if (adapter.ipv4) adapter.ipv4 = adapter.ipv4.replace(/\(.*\)/, '').trim();
      if (adapter.ipv6) adapter.ipv6 = adapter.ipv6.replace(/\(.*\)/, '').trim();

      adapters.push(adapter);
    }

    summary.adapterCount = adapters.length;
    summary.connectedAdapters = adapters.filter(a => a.connected).length;
    summary.adapters = adapters;

    // Check for issues
    const connectedAdapters = adapters.filter(a => a.connected);
    const disconnectedAdapters = adapters.filter(a => !a.connected);

    if (connectedAdapters.length === 0 && adapters.length > 0) {
      issues.push({
        severity: 'critical',
        title: 'No network adapters are connected',
        detail: `All ${adapters.length} network adapter${adapters.length > 1 ? 's are' : ' is'} disconnected.`,
        raw: adapters.map(a => `${a.name}: Disconnected`).join('\n'),
        recommendation: 'Check physical network connections (Ethernet cable or WiFi). Enable network adapters in Network Settings.'
      });
    }

    // Check each connected adapter
    for (const adapter of connectedAdapters) {
      // APIPA address (link-local) — means DHCP failed
      if (adapter.ipv4 && /^169\.254\./i.test(adapter.ipv4)) {
        issues.push({
          severity: 'critical',
          title: `${adapter.name}: APIPA address detected (no DHCP)`,
          detail: `Adapter "${adapter.name}" has IP ${adapter.ipv4}, which is a self-assigned address. This means DHCP failed and the adapter cannot reach the network.`,
          raw: `${adapter.name}: IPv4 ${adapter.ipv4}`,
          recommendation: 'Check DHCP server (router) is running. Try: ipconfig /release && ipconfig /renew. Restart the router if needed.'
        });
      }

      // No gateway
      if (!adapter.gateway || adapter.gateway === '' || adapter.gateway === '0.0.0.0') {
        if (adapter.ipv4 && !/^169\.254\./.test(adapter.ipv4)) {
          issues.push({
            severity: 'warning',
            title: `${adapter.name}: No default gateway configured`,
            detail: `Adapter "${adapter.name}" has IP ${adapter.ipv4} but no default gateway. Internet access will not work.`,
            raw: `${adapter.name}: Gateway: ${adapter.gateway || 'none'}`,
            recommendation: 'Check network configuration. If using static IP, ensure the gateway is set correctly.'
          });
        }
      }

      // No DNS
      if (!adapter.dns || adapter.dns.length === 0 || adapter.dns.every(d => !d)) {
        issues.push({
          severity: 'warning',
          title: `${adapter.name}: No DNS servers configured`,
          detail: `Adapter "${adapter.name}" has no DNS servers. Name resolution will fail.`,
          raw: `${adapter.name}: DNS: none`,
          recommendation: 'Set DNS servers (e.g., 8.8.8.8 and 8.8.4.4 for Google DNS, or 1.1.1.1 for Cloudflare).'
        });
      }
    }

    // Informational: DHCP status
    const dhcpAdapters = connectedAdapters.filter(a => /yes/i.test(a.dhcp));
    const staticAdapters = connectedAdapters.filter(a => /no/i.test(a.dhcp));
    if (staticAdapters.length > 0) {
      issues.push({
        severity: 'info',
        title: `${staticAdapters.length} adapter${staticAdapters.length > 1 ? 's use' : ' uses'} static IP`,
        detail: `Static IP adapters: ${staticAdapters.map(a => `${a.name} (${a.ipv4})`).join(', ')}`,
        raw: '',
        recommendation: 'Static IP is fine for servers/printers. For regular use, DHCP is recommended.'
      });
    }

    if (issues.length === 0) {
      issues.push({
        severity: 'info',
        title: `Network configuration looks healthy`,
        detail: `${connectedAdapters.length} connected adapter${connectedAdapters.length > 1 ? 's' : ''}.`,
        raw: connectedAdapters.map(a => `${a.name}: ${a.ipv4}`).join(', '),
        recommendation: 'No network configuration issues detected.'
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

function extractField(block, label) {
  const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s.]*:\\s*(.+)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function extractAllFields(block, label) {
  const results = [];
  const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s.]*:\\s*(.+)`, 'gi');
  let m;
  while ((m = re.exec(block)) !== null) {
    results.push(m[1].trim());
  }
  // Also grab continuation lines (lines starting with spaces after DNS entry)
  const idx = block.search(re);
  if (idx !== -1) {
    const afterMatch = block.substring(idx);
    const lines = afterMatch.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s{20,}[\d.:a-fA-F]/.test(line)) {
        results.push(line.trim());
      } else if (/^\s/.test(line) && /\d/.test(line) && !/:\s/.test(line.substring(0, 30))) {
        results.push(line.trim());
      } else {
        break;
      }
    }
  }
  return results;
}
