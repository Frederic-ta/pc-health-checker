// Script Generator — generate .bat file for all reports

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};

  var REPORTS = [
    { name: 'Battery Report', command: 'powercfg /batteryreport /output "%OUTDIR%\\battery-report.html"', admin: false },
    { name: 'Energy Report', command: 'powercfg /energy /output "%OUTDIR%\\energy-report.html"', admin: true },
    { name: 'Sleep Study', command: 'powercfg /sleepstudy /output "%OUTDIR%\\sleep-study.html"', admin: false },
    { name: 'MSInfo32 Report', command: 'msinfo32 /report "%OUTDIR%\\msinfo32.txt"', admin: false },
    { name: 'DxDiag Report', command: 'dxdiag /t "%OUTDIR%\\dxdiag.txt"', admin: false },
    { name: 'System Info', command: 'systeminfo > "%OUTDIR%\\systeminfo.txt"', admin: false },
    { name: 'Driver Query', command: 'driverquery /v /fo csv > "%OUTDIR%\\driverquery.csv"', admin: false },
    { name: 'Disk Info', command: 'wmic diskdrive get model,size,status /format:csv > "%OUTDIR%\\disk-info.csv"', admin: false },
    { name: 'Volume Info', command: 'wmic volume get caption,capacity,freespace /format:csv > "%OUTDIR%\\volume-info.csv"', admin: false },
    { name: 'WiFi Report', command: 'netsh wlan show wlanreport & copy "%ProgramData%\\Microsoft\\Windows\\WlanReport\\wlan-report-latest.html" "%OUTDIR%\\wifi-report.html"', admin: true },
    { name: 'Network Config', command: 'ipconfig /all > "%OUTDIR%\\ipconfig.txt"', admin: false },
    { name: 'Installed Updates', command: 'wmic qfe list full /format:csv > "%OUTDIR%\\updates.csv"', admin: false },
    { name: 'System Events', command: 'wevtutil qe System /c:100 /f:xml /rd:true > "%OUTDIR%\\system-events.xml"', admin: true },
    { name: 'Startup Programs', command: 'wmic startup get caption,command /format:csv > "%OUTDIR%\\startup.csv"', admin: false },
    { name: 'Running Processes', command: 'tasklist /v /fo csv > "%OUTDIR%\\tasklist.csv"', admin: false }
  ];

  function generateBatScript() {
    var total = REPORTS.length;
    var lines = [
      '@echo off',
      'echo ================================================',
      'echo   PC Health Checker - Report Generator',
      'echo   Run as Administrator for best results',
      'echo ================================================',
      'echo.',
      '',
      'set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%',
      'set TIMESTAMP=%TIMESTAMP: =0%',
      'set OUTDIR=%USERPROFILE%\\Desktop\\PC-Health-Reports_%TIMESTAMP%',
      'mkdir "%OUTDIR%"',
      'echo Output folder: %OUTDIR%',
      'echo.',
      ''
    ];

    REPORTS.forEach(function(report, idx) {
      var adminNote = report.admin ? ' (may require admin)' : '';
      lines.push('echo [' + (idx + 1) + '/' + total + '] Generating ' + report.name + '...' + adminNote);
      lines.push(report.command + ' 2>nul');
      lines.push('');
    });

    lines.push('echo.');
    lines.push('echo Done! Reports saved to: %OUTDIR%');
    lines.push('echo Drag the folder into PC Health Checker to analyze.');
    lines.push('pause');

    return lines.join('\r\n');
  }

  function downloadBatScript() {
    var content = generateBatScript();
    var blob = new Blob([content], { type: 'application/bat' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'generate-health-reports.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- Linux Shell Script ----
  var LINUX_REPORTS = [
    { name: 'lshw (Hardware)', command: 'sudo lshw -json > "$OUTDIR/lshw.json"', sudo: true },
    { name: 'lspci (PCI Devices)', command: 'lspci -v > "$OUTDIR/lspci.txt"', sudo: false },
    { name: 'dmesg (Kernel Log)', command: 'sudo dmesg --time-format iso > "$OUTDIR/dmesg.txt"', sudo: true },
    { name: 'upower (Battery)', command: 'upower -d > "$OUTDIR/upower.txt" 2>/dev/null', sudo: false },
    { name: 'smartctl (Disk Health)', command: 'for dev in $(lsblk -dno NAME | grep -E "^sd|^nvme"); do sudo smartctl -a /dev/$dev > "$OUTDIR/smartctl-$dev.txt" 2>/dev/null; done', sudo: true },
    { name: 'Memory Info', command: '{ free -h; echo "---MEMINFO---"; cat /proc/meminfo; } > "$OUTDIR/memory-linux.txt"', sudo: false },
    { name: 'Network Info', command: '{ ip addr; echo "---SS---"; ss -tulnp; } > "$OUTDIR/network-linux.txt"', sudo: false },
    { name: 'journalctl (System Log)', command: 'journalctl -b --output=json --no-pager > "$OUTDIR/journalctl.json" 2>/dev/null', sudo: false },
    { name: 'systemd-analyze (Boot)', command: '{ systemd-analyze; echo "---BLAME---"; systemd-analyze blame; } > "$OUTDIR/systemd-analyze.txt" 2>/dev/null', sudo: false },
    { name: 'Pending Updates', command: '{ apt list --upgradable 2>/dev/null || dnf check-update 2>/dev/null; } > "$OUTDIR/linux-updates.txt"', sudo: false }
  ];

  function generateShScript() {
    var total = LINUX_REPORTS.length;
    var lines = [
      '#!/bin/bash',
      '# PC Health Checker - Linux Report Generator',
      '# Run with: sudo bash generate-health-reports.sh',
      '',
      'echo "================================================"',
      'echo "  PC Health Checker - Linux Report Generator"',
      'echo "  Run with sudo for best results"',
      'echo "================================================"',
      'echo ""',
      '',
      'OUTDIR="$HOME/Desktop/PC-Health-Reports_$(date +%Y%m%d_%H%M%S)"',
      'mkdir -p "$OUTDIR"',
      'echo "Output folder: $OUTDIR"',
      'echo ""',
      ''
    ];

    LINUX_REPORTS.forEach(function(report, idx) {
      var sudoNote = report.sudo ? ' (needs sudo)' : '';
      lines.push('echo "[' + (idx + 1) + '/' + total + '] Generating ' + report.name + '...' + sudoNote + '"');
      lines.push(report.command);
      lines.push('');
    });

    lines.push('echo ""');
    lines.push('echo "Done! Reports saved to: $OUTDIR"');
    lines.push('echo "Drag the folder into PC Health Checker to analyze."');

    return lines.join('\n');
  }

  function downloadShScript() {
    var content = generateShScript();
    var blob = new Blob([content], { type: 'text/x-shellscript' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'generate-health-reports.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  window.PCHC.downloadBatScript = downloadBatScript;
  window.PCHC.downloadShScript = downloadShScript;
})();
