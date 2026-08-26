# KIM Dumper AI Dashboard — Haul Road Undulations

HaulPro Fleet Command — HD785-7 (100T) Dumper Intelligence for Kalinga Iron Mine.

Live demo: open leet-dashboard/index.html via a local HTTP server (required for CSV auto-ingest).

## Quick Start
``powershell
# from repo root
python -m http.server 8000
# open
http://localhost:8000/fleet-dashboard/index.html
# Analytics Lab ? Diesel vs Speed heatmap, RPM per dumping, Gradient vs Retarder
# Google Map Track ? Google tiles + Earth Pro KML
``

## What's pushed (minimal web-app + prototype data)

- leet-dashboard/ — full web app (HaulPro Fleet Command)
  - index.html (main dashboard, Analytics Lab, Google Map Track)
  - leet_dashboard.html (legacy simple view)
  - ssets/css/styles.css, ssets/js/{config,data,engine,views,app}.js
  - css/styles.css, js/{app,fleet_data_simulator}.js
- August 8 data/RD20260808151024-HD785-7-N10706.csv — prototype-shift raw telemetry (45 cols, 3102 rows) used by Analytics Lab and auto-ingest

Other raw data folders (Jan 6, Feb, Mar, Dec, etc.) and generated Reports/, Output_* are intentionally **not** pushed (keep repo lean).

## Data Ingest
Drag-drop any RD*-HD785-7-N*.csv (45-col) in **Settings & Data ? Ingest Raw Dumper CSV**, or rely on auto-ingest of the August 8 file when served via http:// (encoded August%208%20data/...).

## Stack
- Chart.js 4.4.4, Leaflet 1.9.4 (Google mt*.google.com tiles, no API key), KML for Google Earth Pro

## License
See LICENSE
"@ -Force; Set-Content -LiteralPath "C:\Users\ayush\AppData\Local\Temp\opencode\kim-dumper\.gitignore" -Value @"
# Python
__pycache__/
*.pyc
*.pyo
Output_*/
Reports/
*.log
.DS_Store
Thumbs.db
