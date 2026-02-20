# PC Health Checker — Roadmap

## v1.0 ✅ (en cours)
- Dashboard Windows avec 15 parsers
- Score global + catégories
- Onboarding, dark/light mode, export markdown
- Script generator .bat/.ps1

## v1.1 — Remédiation intelligente
Chaque issue affiche une **solution actionnable** selon le type de problème :

### Niveaux de remédiation
1. **🔧 Fix automatisable** — commande à copier/exécuter
   - Fichiers corrompus → `sfc /scannow` puis `DISM /Online /Cleanup-Image /RestoreHealth`
   - DNS lent → `ipconfig /flushdns` + changer DNS en 1.1.1.1
   - Trop de startup → `msconfig` ou commande pour désactiver
   - Drivers outdated → lien vers Device Manager + commande `pnputil`
   - Disque fragmenté → `defrag C: /O`
   - Windows Update bloqué → `wuauclt /detectnow` + reset du service

2. **⚠️ Action manuelle requise** — guide step-by-step
   - Batterie dégradée (<50%) → "Envisager remplacement batterie"
   - RAM insuffisante → "Ajouter de la RAM (type: DDR4, slots dispo: X)"
   - Température élevée → "Nettoyer les ventilateurs / changer la pâte thermique"
   - Disque plein → guide nettoyage + `cleanmgr`

3. **🔴 Problème hardware** — diagnostic clair
   - SMART errors → "Disque en fin de vie, sauvegarder et remplacer"
   - BSODs répétés (même code) → mapping des codes courants
   - Batterie cycle count élevé → "Batterie usée, remplacement nécessaire"

### Format dans l'UI
Chaque issue card aura :
- Bouton "📋 Copier la commande" (si fix dispo)
- Badge : 🔧 Fixable | ⚠️ Manuel | 🔴 Hardware
- Explication courte de pourquoi ça marche

## v2.0 — Support Linux
- Nouveau set de parsers Linux :
  - `journalctl` → System events
  - `lshw` / `inxi` → Hardware info
  - `smartctl` → Disk health (SMART)
  - `upower` → Battery
  - `dmesg` → Kernel messages
  - `lspci` / `lsusb` → Devices
  - `free` / `vmstat` → Memory
  - `ss` / `ip` → Network
  - `systemd-analyze` → Boot performance
  - `apt list --upgradable` / `dnf check-update` → Updates
- Script generator → .sh au lieu de .bat
- Auto-détection OS dans l'UI
- Scoring engine + UI identiques

## v3.0 — Ideas
- macOS support (system_profiler, pmset, diskutil...)
- Historique / comparaison entre scans
- PDF export avec graphiques
- Mode "kiosk" pour techniciens

---
*Créé : 20 février 2026*
