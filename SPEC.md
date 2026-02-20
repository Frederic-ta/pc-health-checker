# PC Health Checker — Specification

## Overview
A web-based dashboard that parses Windows diagnostic reports (drag & drop) and displays a unified health summary with a global score, problem detection, and actionable details.

**Stack:** HTML + CSS + vanilla JavaScript (single-page, no backend, no dependencies)

---

## Core Features

### 1. Drag & Drop Report Analyzer
- Drop zone accepting single or multiple report files simultaneously
- Auto-detect report type from file content (battery report, energy report, sleep study, msinfo32, WiFi report, dxdiag, perfmon, etc.)
- Parse and extract key data points from each report
- Supported formats: HTML, XML, TXT, CSV

### 2. Global Health Score
- Score from 0 to 100 displayed prominently
- Calculated from weighted category scores
- Visual gauge/ring with color coding (green 80-100, orange 50-79, red 0-49)
- Breakdown by category visible on hover/click

### 3. Category Dashboard
Reports grouped into visual category cards:

| Category | Icon | Reports Parsed |
|----------|------|---------------|
| ⚡ Power & Battery | Battery Report, Energy Report, Sleep Study, Power Schemes |
| 💻 System & Hardware | MSInfo32, DxDiag, SystemInfo, Driver Query |
| 💾 Storage | Disk Health, Chkdsk, Disk Usage |
| 🌐 Network | WiFi Report, Network Config, Network Stats |
| 🛡️ Security | Windows Update, Event Logs, Antivirus Status, SFC |
| 🚀 Performance | Startup Apps, Process List, Perfmon Report |

Each card shows:
- Category health score (0-100)
- Number of issues found (Critical / Warning / Info)
- Summary of key metrics
- "No data" state when no report for that category has been imported

### 4. Problem List
- Issues sorted by severity: 🔴 Critical → 🟠 Warning → 🔵 Info
- Each problem is clickable → expands to show:
  - Detailed explanation
  - Raw data excerpt from the report
  - Recommendation to fix
- Filter by category and severity

### 5. Search & Filter Bar
- Real-time search across all parsed data
- Type "battery" → shows all battery-related findings
- Type "driver" → shows driver issues
- Filter buttons by category
- Filter buttons by severity level

### 6. Report Generator Section
- Dedicated page/tab listing all available Windows reports
- For each report:
  - Name and description
  - PowerShell/CMD command to run
  - Copy button for the command
  - What kind of data it produces
  - Admin required badge (yes/no)
- "Generate All" button → produces a downloadable .bat or .ps1 script that:
  - Creates a timestamped output folder
  - Runs all report commands
  - Outputs all files into that folder
  - Ready to drag & drop back into the app

### 7. Export
- "Export Summary" button
- Generates a clean text/markdown report with:
  - Global health score
  - Category breakdown
  - All issues found with severity
  - Recommendations
- Copy to clipboard or download as .txt/.md

---

## Supported Reports & Parsers

### Power & Battery
| Report | Command | Format | Key Data |
|--------|---------|--------|----------|
| Battery Report | `powercfg /batteryreport /output "%path%"` | HTML | Design capacity, full charge capacity, cycle count, battery health %, recent usage |
| Energy Report | `powercfg /energy /output "%path%"` | HTML | Errors, warnings, informational items, power policy issues |
| Sleep Study | `powercfg /sleepstudy /output "%path%"` | HTML | Sleep sessions, drain rate, top offenders, wake sources |
| Power Schemes | `powercfg /query > "%path%"` | TXT | Active plan, settings |
| Wake Timers | `powercfg /waketimers > "%path%"` | TXT | Scheduled wake events |

### System & Hardware
| Report | Command | Format | Key Data |
|--------|---------|--------|----------|
| MSInfo32 | `msinfo32 /report "%path%"` | TXT | OS, CPU, RAM, GPU, drivers, devices, conflicts |
| DxDiag | `dxdiag /t "%path%"` | TXT | GPU details, DirectX version, display driver, audio devices, problems found |
| System Info | `systeminfo > "%path%"` | TXT | OS version, boot time, RAM, network, hotfixes installed |
| Driver Query | `driverquery /v /fo csv > "%path%"` | CSV | All drivers, versions, dates, status |

### Storage
| Report | Command | Format | Key Data |
|--------|---------|--------|----------|
| Disk Info | `wmic diskdrive get model,size,status /format:csv > "%path%"` | CSV | Disk model, size, health status |
| Volume Info | `wmic volume get caption,capacity,freespace /format:csv > "%path%"` | CSV | Partition sizes, free space |

### Network
| Report | Command | Format | Key Data |
|--------|---------|--------|----------|
| WiFi Report | `netsh wlan show wlanreport` | HTML | Connection history, disconnects, signal quality, errors |
| Network Config | `ipconfig /all > "%path%"` | TXT | IP, DNS, DHCP, adapters |
| Firewall Status | `netsh advfirewall show allprofiles > "%path%"` | TXT | Firewall state per profile |

### Security
| Report | Command | Format | Key Data |
|--------|---------|--------|----------|
| Installed Updates | `wmic qfe list full /format:csv > "%path%"` | CSV | Hotfixes, dates, KB numbers |
| System Events | `wevtutil qe System /c:100 /f:xml /rd:true > "%path%"` | XML | Recent errors, warnings, BSODs |
| SFC Scan | `sfc /verifyonly > "%path%"` | TXT | File integrity status |

### Performance
| Report | Command | Format | Key Data |
|--------|---------|--------|----------|
| Perfmon Report | `perfmon /report` | HTML | CPU, disk, memory, network diagnostics |
| Startup Programs | `wmic startup get caption,command /format:csv > "%path%"` | CSV | Programs at boot, paths |
| Running Processes | `tasklist /v /fo csv > "%path%"` | CSV | Active processes, memory usage, CPU time |

---

## UI/UX Design

### Layout
```
┌─────────────────────────────────────────────┐
│  🏥 PC Health Checker          [🌙/☀️] [Export] │
├─────────────────────────────────────────────┤
│  [Analyze] [Reports & Commands] [About]     │
├─────────────────────────────────────────────┤
│                                             │
│    ╔═══════════════════════════════╗        │
│    ║   DROP REPORT FILES HERE     ║        │
│    ║   or click to browse         ║        │
│    ╚═══════════════════════════════╝        │
│                                             │
│    ┌──────────────────────┐                 │
│    │   HEALTH SCORE: 73   │                 │
│    │   ████████░░ 73/100  │                 │
│    └──────────────────────┘                 │
│                                             │
│  [Search...              ] [All▼] [Sev▼]   │
│                                             │
│  ⚡ Power    💻 System   💾 Storage         │
│  ██░░ 65    ████ 89     ███░ 78            │
│                                             │
│  🌐 Network  🛡️ Security 🚀 Performance    │
│  █░░░ 42    ████ 91     ██░░ 58            │
│                                             │
│  ── Problems Found (7) ──────────────       │
│  🔴 Battery health at 43% (Critical)       │
│  🔴 WiFi disconnected 15x today            │
│  🟠 12 outdated drivers found              │
│  🟠 23 startup programs (slow boot)        │
│  🔵 Last Windows update: 45 days ago       │
│  ...                                        │
└─────────────────────────────────────────────┘
```

### Theme
- Dark mode by default, toggle to light
- Color palette: dark grays (#1a1a2e, #16213e) + accent colors for severity
- Clean, modern, minimal — no clutter
- Responsive (desktop-first, but works on tablet/phone)

### Onboarding
- First-launch welcome overlay with 3-4 step guided tour
- Highlights: drop zone, report generator, health score, export
- "Don't show again" checkbox, stored in localStorage
- Subtle tooltip hints on hover for key UI elements

### Interactions
- Drag & drop with visual feedback (highlight zone, progress indicator)
- Smooth animations on score calculation
- Expandable problem cards with slide animation
- Category cards clickable for detailed view
- Toast notifications for file parsing status
- Copy-to-clipboard button on each finding/issue (for pasting into tickets/emails)

---

## Technical Architecture

```
index.html          — Single page, all UI
├── css/
│   └── styles.css  — All styles, dark/light theme via CSS variables
├── js/
│   ├── app.js      — Main app logic, routing between tabs
│   ├── parsers/
│   │   ├── battery.js    — Battery report parser
│   │   ├── energy.js     — Energy report parser
│   │   ├── sleep.js      — Sleep study parser
│   │   ├── msinfo.js     — MSInfo32 parser
│   │   ├── dxdiag.js     — DxDiag parser
│   │   ├── sysinfo.js    — SystemInfo parser
│   │   ├── drivers.js    — Driver query parser
│   │   ├── disk.js       — Disk info parser
│   │   ├── wifi.js       — WiFi report parser
│   │   ├── network.js    — Network config parser
│   │   ├── updates.js    — Windows updates parser
│   │   ├── events.js     — System events parser
│   │   ├── perfmon.js    — Perfmon report parser
│   │   ├── startup.js    — Startup programs parser
│   │   ├── processes.js  — Process list parser
│   │   └── index.js      — Parser registry & auto-detection
│   ├── scoring.js   — Health score calculation engine
│   ├── search.js    — Search & filter logic
│   ├── export.js    — Export to text/markdown
│   ├── generator.js — Script generator (.bat/.ps1)
│   └── ui.js        — UI components, theme toggle, animations
└── assets/
    └── icons/       — Category icons (SVG)
```

### Parser Interface
Each parser module exports:
```javascript
export default {
  name: 'Battery Report',
  category: 'power',
  detect(content, filename) → boolean,    // Auto-detect if file matches
  parse(content) → {
    summary: { ... },                      // Key metrics
    score: 0-100,                          // Category contribution
    issues: [
      { severity: 'critical'|'warning'|'info', title, detail, raw, recommendation }
    ]
  }
}
```

### Scoring Engine
- Each category has a weight (configurable)
- Default weights: Power 20%, System 20%, Storage 15%, Network 15%, Security 15%, Performance 15%
- Global score = weighted average of category scores
- Category score = derived from parser issues (critical = -30pts, warning = -10pts, info = -2pts, starting from 100)

---

## Script Generator Output

### generate-all.bat
```batch
@echo off
echo ================================================
echo   PC Health Checker - Report Generator
echo   Run as Administrator for best results
echo ================================================
set OUTDIR=%USERPROFILE%\Desktop\PC-Health-Reports_%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%
mkdir "%OUTDIR%"

echo [1/15] Generating Battery Report...
powercfg /batteryreport /output "%OUTDIR%\battery-report.html" 2>nul

echo [2/15] Generating Energy Report...
powercfg /energy /output "%OUTDIR%\energy-report.html" 2>nul

echo [3/15] Generating Sleep Study...
powercfg /sleepstudy /output "%OUTDIR%\sleep-study.html" 2>nul

:: ... etc for all reports

echo ================================================
echo   Done! Reports saved to: %OUTDIR%
echo   Drag the folder into PC Health Checker
echo ================================================
pause
```

---

## Non-Goals (for now)
- No backend / no server
- No real-time monitoring
- No history / persistent storage
- No AI / LLM integration
- No installation required — just open index.html
- No data sent anywhere — 100% offline & private

---

## Name
**PC Health Checker** (working title)

*Version 1.0 — Spec written February 2026*
