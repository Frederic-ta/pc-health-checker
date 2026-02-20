// Script Generator — generate .bat file and individual commands for reports

const REPORTS = [
  {
    name: 'Battery Report',
    command: 'powercfg /batteryreport /output "%OUTDIR%\\battery-report.html"',
    singleCommand: 'powercfg /batteryreport /output "%USERPROFILE%\\Desktop\\battery-report.html"',
    description: 'Battery health, capacity, cycle count, and usage history',
    format: 'HTML',
    admin: false,
    filename: 'battery-report.html'
  },
  {
    name: 'Energy Report',
    command: 'powercfg /energy /output "%OUTDIR%\\energy-report.html"',
    singleCommand: 'powercfg /energy /output "%USERPROFILE%\\Desktop\\energy-report.html"',
    description: 'Power efficiency diagnostics — errors, warnings, and power policy issues',
    format: 'HTML',
    admin: true,
    filename: 'energy-report.html'
  },
  {
    name: 'Sleep Study',
    command: 'powercfg /sleepstudy /output "%OUTDIR%\\sleep-study.html"',
    singleCommand: 'powercfg /sleepstudy /output "%USERPROFILE%\\Desktop\\sleep-study.html"',
    description: 'Sleep/standby sessions, battery drain during sleep, wake sources',
    format: 'HTML',
    admin: false,
    filename: 'sleep-study.html'
  },
  {
    name: 'MSInfo32 Report',
    command: 'msinfo32 /report "%OUTDIR%\\msinfo32.txt"',
    singleCommand: 'msinfo32 /report "%USERPROFILE%\\Desktop\\msinfo32.txt"',
    description: 'Complete system hardware/software inventory — CPU, RAM, GPU, drivers, devices',
    format: 'TXT',
    admin: false,
    filename: 'msinfo32.txt'
  },
  {
    name: 'DxDiag Report',
    command: 'dxdiag /t "%OUTDIR%\\dxdiag.txt"',
    singleCommand: 'dxdiag /t "%USERPROFILE%\\Desktop\\dxdiag.txt"',
    description: 'DirectX diagnostics — GPU, display driver, audio devices, problems found',
    format: 'TXT',
    admin: false,
    filename: 'dxdiag.txt'
  },
  {
    name: 'System Info',
    command: 'systeminfo > "%OUTDIR%\\systeminfo.txt"',
    singleCommand: 'systeminfo > "%USERPROFILE%\\Desktop\\systeminfo.txt"',
    description: 'OS version, boot time, uptime, RAM, network configuration, hotfixes',
    format: 'TXT',
    admin: false,
    filename: 'systeminfo.txt'
  },
  {
    name: 'Driver Query',
    command: 'driverquery /v /fo csv > "%OUTDIR%\\driverquery.csv"',
    singleCommand: 'driverquery /v /fo csv > "%USERPROFILE%\\Desktop\\driverquery.csv"',
    description: 'All installed drivers with version, date, and status',
    format: 'CSV',
    admin: false,
    filename: 'driverquery.csv'
  },
  {
    name: 'Disk Info',
    command: 'wmic diskdrive get model,size,status /format:csv > "%OUTDIR%\\disk-info.csv"',
    singleCommand: 'wmic diskdrive get model,size,status /format:csv > "%USERPROFILE%\\Desktop\\disk-info.csv"',
    description: 'Physical disk models, sizes, and health status',
    format: 'CSV',
    admin: false,
    filename: 'disk-info.csv'
  },
  {
    name: 'Volume Info',
    command: 'wmic volume get caption,capacity,freespace /format:csv > "%OUTDIR%\\volume-info.csv"',
    singleCommand: 'wmic volume get caption,capacity,freespace /format:csv > "%USERPROFILE%\\Desktop\\volume-info.csv"',
    description: 'Partition sizes and free space',
    format: 'CSV',
    admin: false,
    filename: 'volume-info.csv'
  },
  {
    name: 'WiFi Report',
    command: 'netsh wlan show wlanreport & copy "%ProgramData%\\Microsoft\\Windows\\WlanReport\\wlan-report-latest.html" "%OUTDIR%\\wifi-report.html"',
    singleCommand: 'netsh wlan show wlanreport & copy "%ProgramData%\\Microsoft\\Windows\\WlanReport\\wlan-report-latest.html" "%USERPROFILE%\\Desktop\\wifi-report.html"',
    description: 'WiFi connection history, disconnects, signal quality, errors',
    format: 'HTML',
    admin: true,
    filename: 'wifi-report.html'
  },
  {
    name: 'Network Config',
    command: 'ipconfig /all > "%OUTDIR%\\ipconfig.txt"',
    singleCommand: 'ipconfig /all > "%USERPROFILE%\\Desktop\\ipconfig.txt"',
    description: 'IP addresses, DNS servers, DHCP, network adapter details',
    format: 'TXT',
    admin: false,
    filename: 'ipconfig.txt'
  },
  {
    name: 'Installed Updates',
    command: 'wmic qfe list full /format:csv > "%OUTDIR%\\updates.csv"',
    singleCommand: 'wmic qfe list full /format:csv > "%USERPROFILE%\\Desktop\\updates.csv"',
    description: 'Windows hotfixes and updates with install dates',
    format: 'CSV',
    admin: false,
    filename: 'updates.csv'
  },
  {
    name: 'System Events',
    command: 'wevtutil qe System /c:100 /f:xml /rd:true > "%OUTDIR%\\system-events.xml"',
    singleCommand: 'wevtutil qe System /c:100 /f:xml /rd:true > "%USERPROFILE%\\Desktop\\system-events.xml"',
    description: 'Recent system event log entries — errors, warnings, BSODs',
    format: 'XML',
    admin: true,
    filename: 'system-events.xml'
  },
  {
    name: 'Startup Programs',
    command: 'wmic startup get caption,command /format:csv > "%OUTDIR%\\startup.csv"',
    singleCommand: 'wmic startup get caption,command /format:csv > "%USERPROFILE%\\Desktop\\startup.csv"',
    description: 'Programs that launch at boot',
    format: 'CSV',
    admin: false,
    filename: 'startup.csv'
  },
  {
    name: 'Running Processes',
    command: 'tasklist /v /fo csv > "%OUTDIR%\\tasklist.csv"',
    singleCommand: 'tasklist /v /fo csv > "%USERPROFILE%\\Desktop\\tasklist.csv"',
    description: 'All running processes with memory usage and CPU time',
    format: 'CSV',
    admin: false,
    filename: 'tasklist.csv'
  }
];

/**
 * Generate the full .bat script that runs all report commands.
 * @returns {string} Batch file content
 */
export function generateBatScript() {
  const totalReports = REPORTS.length;
  const lines = [
    '@echo off',
    'echo ================================================',
    'echo   PC Health Checker - Report Generator',
    'echo   Run as Administrator for best results',
    'echo ================================================',
    'echo.',
    '',
    'REM Create timestamped output folder on Desktop',
    'set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%',
    'set TIMESTAMP=%TIMESTAMP: =0%',
    'set OUTDIR=%USERPROFILE%\\Desktop\\PC-Health-Reports_%TIMESTAMP%',
    'mkdir "%OUTDIR%"',
    '',
    'echo Output folder: %OUTDIR%',
    'echo.',
    ''
  ];

  REPORTS.forEach((report, idx) => {
    const step = idx + 1;
    const adminNote = report.admin ? ' (may require admin)' : '';
    lines.push(`echo [${step}/${totalReports}] Generating ${report.name}...${adminNote}`);
    lines.push(`${report.command} 2>nul`);
    lines.push('');
  });

  lines.push('echo.');
  lines.push('echo ================================================');
  lines.push('echo   Done! %COUNTER% reports generated.');
  lines.push('echo   Reports saved to: %OUTDIR%');
  lines.push('echo.');
  lines.push('echo   Drag the folder into PC Health Checker');
  lines.push('echo   to analyze your system health.');
  lines.push('echo ================================================');
  lines.push('echo.');
  lines.push('pause');

  return lines.join('\r\n');
}

/**
 * Download the .bat script as a file.
 */
export function downloadBatScript() {
  const content = generateBatScript();
  const blob = new Blob([content], { type: 'application/bat' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'generate-health-reports.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get the list of all report definitions.
 * @returns {Array<{ name, command, singleCommand, description, format, admin, filename }>}
 */
export function getReports() {
  return REPORTS;
}

/**
 * Get the single-command string for a specific report (for copy-to-clipboard).
 * @param {string} reportName
 * @returns {string|null}
 */
export function getSingleCommand(reportName) {
  const report = REPORTS.find(r => r.name === reportName);
  return report ? report.singleCommand : null;
}

/**
 * Copy a single report command to clipboard.
 * @param {string} reportName
 * @returns {Promise<boolean>}
 */
export async function copyCommand(reportName) {
  const cmd = getSingleCommand(reportName);
  if (!cmd) return false;
  try {
    await navigator.clipboard.writeText(cmd);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = cmd;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

export default { generateBatScript, downloadBatScript, getReports, getSingleCommand, copyCommand };
