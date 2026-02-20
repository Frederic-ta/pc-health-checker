// Remediation Engine — maps issues to fix types, commands, and guides

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};

  var REMEDIATIONS = [
    // Battery / Power
    { pattern: /battery.*(?:critically|very)\s*low|battery.*health.*(?:[0-3]\d|[0-4]0)%/i, fixType: 'hardware', command: null, guide: 'Battery is severely degraded. Replace the battery or contact the manufacturer for a replacement part.' },
    { pattern: /battery.*(?:degraded|health.*(?:[4-7]\d)%)/i, fixType: 'manual', command: null, guide: 'Battery health is declining. Calibrate by fully charging, then discharging to ~5%, then fully charging again. Avoid extreme temperatures.' },
    { pattern: /high.*(?:battery|power).*drain/i, fixType: 'fixable', command: 'powercfg /energy', guide: 'Run an energy report to identify power-hungry components. Check background apps and adjust power plan to "Balanced" or "Power Saver".' },
    { pattern: /high.*cycle\s*count/i, fixType: 'hardware', command: null, guide: 'Battery has exceeded its rated charge cycle life. Consider replacing the battery to restore full capacity.' },

    // Drivers
    { pattern: /outdated.*driver|driver.*outdated|old.*driver/i, fixType: 'fixable', command: 'pnputil /scan-devices', guide: 'Update outdated drivers via Device Manager > right-click device > Update driver, or download from the manufacturer website.' },
    { pattern: /driver.*error|driver.*problem|device.*error/i, fixType: 'fixable', command: 'pnputil /scan-devices', guide: 'Reinstall the problematic driver: Device Manager > right-click > Uninstall device > Scan for hardware changes.' },

    // Startup / Performance
    { pattern: /(?:high|many|too many).*startup|startup.*(?:count|programs?).*(?:high|\d{2,})/i, fixType: 'fixable', command: 'msconfig', guide: 'Open Task Manager > Startup tab, and disable unnecessary startup programs to speed up boot time.' },
    { pattern: /slow.*boot|boot.*slow|long.*boot/i, fixType: 'fixable', command: 'systemd-analyze blame', guide: 'Identify slow boot services. Disable unnecessary services that delay startup.' },

    // Disk / Storage
    { pattern: /low.*(?:disk|storage|space)|disk.*(?:space|full)|free.*space.*(?:low|critical)/i, fixType: 'fixable', command: 'cleanmgr', guide: 'Run Disk Cleanup (cleanmgr) to remove temporary files. Uninstall unused programs. Move large files to external storage.' },
    { pattern: /bad\s*sectors|reallocated|pending\s*sectors/i, fixType: 'hardware', command: null, guide: 'Disk has failing sectors. Back up data immediately and plan to replace the drive.' },
    { pattern: /disk.*(?:temperature|temp).*high|high.*disk.*temp/i, fixType: 'manual', command: null, guide: 'Ensure adequate airflow around the drive. Clean dust from vents and fans. Consider adding a cooling pad for laptops.' },
    { pattern: /smart.*(?:fail|warning|alert)/i, fixType: 'hardware', command: null, guide: 'SMART health check indicates the drive may be failing. Back up all data immediately and replace the drive.' },

    // WiFi / Network
    { pattern: /wifi.*disconnect|wireless.*disconnect|wifi.*drop|connection.*drop/i, fixType: 'fixable', command: 'netsh wlan show wlanreport', guide: 'Reset the WiFi adapter: Settings > Network > Wi-Fi > Manage > Forget network, then reconnect. Update WiFi drivers.' },
    { pattern: /no.*(?:ip|network|internet)|network.*(?:down|unavailable)/i, fixType: 'fixable', command: 'ipconfig /release && ipconfig /renew', guide: 'Release and renew IP address. If that fails, reset the network stack: netsh winsock reset && netsh int ip reset' },
    { pattern: /interface.*down|link.*down/i, fixType: 'fixable', command: 'sudo ip link set <iface> up', guide: 'Bring the interface up. Check cable connections or WiFi settings if the issue persists.' },

    // Updates / Security
    { pattern: /missing.*update|update.*missing|no.*recent.*update|days.*since.*update.*(?:[6-9]\d|\d{3,})/i, fixType: 'fixable', command: 'wuauclt /detectnow', guide: 'Open Windows Update (Settings > Update & Security) and install all pending updates to stay protected.' },
    { pattern: /pending.*update|upgradable.*package|package.*upgrade/i, fixType: 'fixable', command: 'sudo apt update && sudo apt upgrade -y', guide: 'Install pending package updates to get the latest security patches and bug fixes.' },
    { pattern: /critical.*event|critical.*error|kernel.*panic|oops/i, fixType: 'manual', command: null, guide: 'Review the critical events in detail. These may indicate hardware failure, driver bugs, or OS corruption. Consider running system file checks.' },
    { pattern: /segfault|segmentation\s*fault/i, fixType: 'manual', command: null, guide: 'Segmentation faults indicate software or memory issues. Test RAM with memtest86+ and check for software updates.' },

    // Memory
    { pattern: /high.*memory.*usage|memory.*(?:high|critical|full)|ram.*(?:full|maxed|high)/i, fixType: 'fixable', command: 'tasklist /v /fo csv', guide: 'Close memory-hungry applications. Check for memory leaks. Consider adding more RAM if usage is consistently high.' },
    { pattern: /high.*swap|swap.*(?:usage|full|high)/i, fixType: 'manual', command: null, guide: 'High swap usage means RAM is full. Close unused applications or add more RAM. Increasing swap size is a temporary workaround.' },

    // GPU
    { pattern: /gpu.*(?:error|problem|issue)|display.*(?:error|problem)/i, fixType: 'fixable', command: null, guide: 'Update GPU drivers from the manufacturer website (NVIDIA, AMD, or Intel). Use DDU (Display Driver Uninstaller) for a clean reinstall if needed.' },

    // System events
    { pattern: /unexpected\s*shutdown|improper\s*shutdown|bsod|blue\s*screen/i, fixType: 'manual', command: 'sfc /scannow', guide: 'Run System File Checker (sfc /scannow) and DISM (DISM /Online /Cleanup-Image /RestoreHealth) to repair system files.' },

    // USB / Hardware errors
    { pattern: /usb.*(?:error|fail|disconnect)|device.*descriptor.*read/i, fixType: 'manual', command: null, guide: 'Try a different USB port. Check the USB cable. If the issue persists, the USB device or port may be faulty.' },
    { pattern: /hardware.*error|pcie.*error|mce|machine\s*check/i, fixType: 'hardware', command: null, guide: 'Hardware errors detected. Run hardware diagnostics from the manufacturer. Check for overheating and loose connections.' }
  ];

  function getRemediation(issue) {
    var text = (issue.title || '') + ' ' + (issue.detail || '') + ' ' + (issue.recommendation || '');

    for (var i = 0; i < REMEDIATIONS.length; i++) {
      var r = REMEDIATIONS[i];
      if (r.pattern.test(text)) {
        return { fixType: r.fixType, command: r.command, guide: r.guide };
      }
    }

    // Default: no specific remediation found
    return null;
  }

  window.PCHC.getRemediation = getRemediation;
})();
