# 🏥 PC Health Checker

A web-based diagnostic dashboard that analyzes Windows and Linux system reports and displays a unified health summary — with a global score, problem detection, and actionable remediation tips.

**100% client-side. No backend. No dependencies. Fully offline and private.**

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## ✨ Features

- **Drag & Drop** — Drop one or multiple diagnostic report files, they're auto-detected and parsed instantly
- **25+ Parsers** — Supports Windows and Linux reports (see full list below)
- **Global Health Score** — 0-100 score with color-coded gauge, weighted by category
- **6 Categories** — ⚡ Power & Battery · 💻 System & Hardware · 💾 Storage · 🌐 Network · 🛡️ Security · 🚀 Performance
- **Problem Detection** — Issues sorted by severity (🔴 Critical → 🟠 Warning → 🔵 Info) with explanations
- **Smart Remediation** — Each issue comes with a fix: copyable commands, step-by-step guides, or hardware diagnosis
- **Script Generator** — Generate `.bat`, `.ps1`, or `.sh` scripts to collect all reports in one click
- **Search & Filter** — Filter issues by category, severity, or keyword
- **Export** — Export results as Markdown
- **Dark Mode** — Default dark theme
- **Onboarding Wizard** — Guided first-use experience

---

## 🚀 Getting Started

### 1. Open the app

Just open `index-v2.html` in any modern browser. No installation needed.

### 2. Generate diagnostic reports

Go to the **Reports & Commands** tab and either:
- Copy individual commands to run in your terminal
- Download a ready-made script (`.bat` / `.ps1` for Windows, `.sh` for Linux) that generates all reports at once

### 3. Drop the reports

Drag & drop the generated report files onto the drop zone. The app auto-detects the report type and parses everything instantly.

### 4. Review results

- Check the **global health score**
- Browse issues by category
- Click any issue for details + remediation steps
- Export the report if needed

---

## 📁 Project Structure

```
pc-health-checker/
├── index-v2.html          # Main app (use this one)
├── index.html             # Legacy v1
├── css/
│   ├── styles-v2.css      # Main stylesheet
│   └── styles.css         # Legacy v1 styles
└── js/
    ├── app.js             # Main application logic & state management
    ├── ui.js              # DOM manipulation & rendering
    ├── scoring.js         # Health score calculation engine
    ├── remediation.js     # Fix suggestions per issue type
    ├── export.js          # Markdown export
    ├── search.js          # Search & filter logic
    ├── generator.js       # Script generator (bat/ps1/sh)
    └── parsers/
        ├── index.js       # Parser registry & auto-detection
        │
        │── # Windows parsers
        ├── battery.js     # Battery Report (powercfg)
        ├── energy.js      # Energy Report (powercfg)
        ├── sleep.js       # Sleep Study (powercfg)
        ├── msinfo.js      # MSInfo32
        ├── dxdiag.js      # DxDiag
        ├── sysinfo.js     # SystemInfo
        ├── drivers.js     # Driver Query
        ├── disk.js        # Disk & Volume info
        ├── wifi.js        # WiFi Report (netsh)
        ├── network.js     # Network Config (ipconfig)
        ├── updates.js     # Windows Update history
        ├── events.js      # Event Logs
        ├── startup.js     # Startup Apps
        ├── processes.js   # Process List
        │
        │── # Linux parsers
        ├── journalctl.js      # journalctl logs
        ├── lshw.js            # Hardware info (lshw)
        ├── lspci.js           # PCI devices
        ├── smartctl.js        # SMART disk health
        ├── upower.js         # Battery (upower)
        ├── dmesg.js           # Kernel messages
        ├── memory-linux.js    # Memory (free/vmstat)
        ├── network-linux.js   # Network (ip/ss)
        ├── systemd-analyze.js # Boot performance
        └── linux-updates.js   # Package updates
```

---

## ⚙️ How It Works

### Architecture

The app follows a simple pipeline: **Detect → Parse → Score → Render**

```
[File Drop] → [Auto-Detect] → [Parser] → [Scoring Engine] → [UI Render]
```

1. **Auto-Detection** (`parsers/index.js`) — When a file is dropped, the registry loops through all parsers and calls each parser's `detect(content, filename)` function. The first parser that matches handles the file.

2. **Parsing** — Each parser exposes:
   - `name` — Parser display name
   - `category` — One of: `power`, `system`, `storage`, `network`, `security`, `performance`
   - `detect(content, filename)` — Returns `true` if this parser can handle the file
   - `parse(content)` — Returns `{ summary, issues[] }` where each issue has a `severity` (critical/warning/info), `title`, and `detail`

3. **Scoring** (`scoring.js`) — Category scores start at 100 and lose points per issue:
   - 🔴 Critical: **-30 points**
   - 🟠 Warning: **-10 points**
   - 🔵 Info: **-2 points**
   
   The **global score** is a weighted average across categories:
   | Category | Weight |
   |----------|--------|
   | ⚡ Power & Battery | 20% |
   | 💻 System & Hardware | 20% |
   | 💾 Storage | 15% |
   | 🌐 Network | 15% |
   | 🛡️ Security | 15% |
   | 🚀 Performance | 15% |

4. **Remediation** (`remediation.js`) — Each issue is enriched with actionable fixes:
   - 🔧 **Auto-fixable** — A command you can copy-paste and run
   - ⚠️ **Manual action** — Step-by-step guide
   - 🔴 **Hardware issue** — Diagnosis and recommendation

5. **State Management** (`app.js`) — The app keeps a `Map` of all parsed results, recalculates scores on each new file drop, and triggers a UI re-render.

6. **Rendering** (`ui.js`) — Pure DOM manipulation, no framework. Category cards, issue lists, score gauge — all built dynamically.

### Adding a New Parser

Create a new file in `js/parsers/`:

```javascript
(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.myParser = {
    name: 'My Report',
    category: 'system', // power|system|storage|network|security|performance
    
    detect: function(content, filename) {
      // Return true if this file matches your report type
      return filename.includes('my-report') || content.includes('MY_SIGNATURE');
    },
    
    parse: function(content) {
      var issues = [];
      // Analyze content, push issues...
      issues.push({
        severity: 'warning', // critical|warning|info
        title: 'Something needs attention',
        detail: 'Explanation of the problem and raw data'
      });
      
      return {
        summary: 'Brief summary of findings',
        issues: issues
      };
    }
  };
})();
```

Then add a `<script>` tag in `index-v2.html` to load it.

---

## 🔒 Privacy

Everything runs in your browser. No data is sent anywhere. No analytics, no tracking, no external requests. Your diagnostic data stays on your machine.

---

## 📄 License

MIT

---

*Built with ☕ and 🐱 by KatKat & the Kuro Brigade*
