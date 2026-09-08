"""
kim_august8_gradient.py
-----------------------
Adapted from kim_combined.py (KIM_Export_Bundle Gradient Analysis)
Same logic, same color-coding, but for August 8 Dumper CSV:
  August 8 data/RD20260808151024-HD785-7-N10706.csv
  (also supports data/august-8/RD...csv for Vercel)

Original CSV (Positions Data KIM 17-18.csv) uses UTM Northing/Easting/Elevation
August 8 CSV uses GPS_Latitude (N2156.4320), GPS_Longitude (E08523.1500), GPS_Altitude

Logic identical:
 - MAX_DISTANCE_GAP_M / MAX_TIME_GAP_SECONDS → split into contiguous paths
 - Smoothing window 3 for elevation
 - Segment into ELEVATION (>2% grade) vs PLAN (≤2%)
 - For ELEVATION: avg_grad >10% → red, >6.25% → yellow, else green
 - For PLAN: green + bump detector (>1m height, ≥1m span → green hazard)
 - Output KML with folders: Continuous Elevations / Plan Paths / Detected Bumps
 - Single top-level folder "August 8 — N10706" (like Shift 1)

Usage:
    python kim_august8_gradient.py
    python kim_august8_gradient.py --input "../../August 8 data/RD20260808151024-HD785-7-N10706.csv"
"""

import csv
import math
import os
import simplekml
from datetime import datetime
from collections import defaultdict

# ─────────────────────────────────────────────────────────────────────────────
# Configuration (identical to kim_combined.py)
# ─────────────────────────────────────────────────────────────────────────────
MAX_DISTANCE_GAP_M      = 150.0
MAX_TIME_GAP_SECONDS    = 180
SMOOTHING_WINDOW_SIZE   = 3
CLIMB_GRADIENT_THRESHOLD= 0.02  # 2% grade
BUMP_HEIGHT_THRESHOLD_M = 1.0
BUMP_MIN_LENGTH_M       = 1.0
RAISE_HEIGHT_M          = 3.0

# ─────────────────────────────────────────────────────────────────────────────
# Helpers — same as original, plus GPS parse & haversine
# ─────────────────────────────────────────────────────────────────────────────

def parse_coordinate(coord_str):
    """Parse N2156.4320 / E08523.1500 → decimal degrees (from comprehensive_dumper_analysis.py)"""
    if not coord_str:
        return None
    coord_str = coord_str.strip()
    if not coord_str:
        return None
    direction = coord_str[0]
    value_str = coord_str[1:]
    try:
        value = float(value_str)
    except ValueError:
        return None
    dot = value_str.find('.')
    if dot == -1:
        return None
    int_part = value_str[:dot]
    frac_part = value_str[dot:]
    if len(int_part) < 3:
        degrees = 0
        minutes = float(value_str)
    else:
        mins_str = int_part[-2:] + frac_part
        deg_str = int_part[:-2]
        try:
            degrees = float(deg_str)
            minutes = float(mins_str)
        except ValueError:
            return None
    dec = degrees + (minutes / 60.0)
    if direction in ['S', 'W']:
        dec = -dec
    return dec

def haversine_m(lat1, lon1, lat2, lon2):
    """Haversine distance in meters for lat/lon decimal degrees"""
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def _dist_latlon(p1, p2):
    return haversine_m(p1['lat'], p1['lon'], p2['lat'], p2['lon'])

# ─────────────────────────────────────────────────────────────────────────────
# 1. Load August 8 CSV — group by date (single date) → {date: {shift: [points]}}
# ─────────────────────────────────────────────────────────────────────────────
def load_and_group_august8(input_csv: str) -> dict:
    """
    Returns nested dict like original: { "08-08-2026": { "1": [pts] } }
    Each pt: {ts, lat, lon, z, n, e} where n/e are lat/lon for distance calc,
             z = GPS_Altitude, plus Gradient_deg for reference
    """
    with open(input_csv, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        # Validate header
        if 'GPS_Latitude' not in reader.fieldnames or 'GPS_Longitude' not in reader.fieldnames:
            raise RuntimeError(f"Expected GPS_Latitude/GPS_Longitude in header, got {reader.fieldnames}")

        data = defaultdict(lambda: defaultdict(list))
        skipped = 0
        total = 0
        for row in reader:
            try:
                # Time: "08-08-2026 15:10" — use GPS_Date + GPS_Time if available for seconds
                time_raw = (row.get('Time') or '').strip()
                gps_date = (row.get('GPS_Date') or '').strip()
                gps_time = (row.get('GPS_Time') or '').strip()
                # Try to parse Time first
                ts = None
                for fmt in ('%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M', '%m-%d-%Y %H:%M', '%Y-%m-%d %H:%M:%S'):
                    try:
                        ts = datetime.strptime(time_raw, fmt)
                        break
                    except ValueError:
                        pass
                if ts is None or ts == datetime.min:
                    # fallback: try GPS_Date + GPS_Time (80826 = 08-08-2026? Actually GPS_Date is like 80826)
                    # GPS_Time is like 94029 (09:40:29)
                    # For August 8, Time is sufficient, so just use current row index time
                    ts = datetime.min
                    # If we have GPS_GPSTime-like, try to reconstruct
                    if gps_time and len(gps_time) >= 5:
                        try:
                            # GPS_Time like 94029 -> 09:40:29
                            t = gps_time.zfill(6)
                            hh, mm, ss = int(t[0:2]), int(t[2:4]), int(t[4:6])
                            # Use date from Time
                            base_date = datetime.strptime(time_raw.split(' ')[0], '%d-%m-%Y') if ' ' in time_raw else datetime(2026,8,8)
                            ts = base_date.replace(hour=hh, minute=mm, second=ss)
                        except Exception:
                            ts = datetime.min
                if ts is None or ts == datetime.min:
                    # use row index as time proxy (1 sec per row, starting 15:10)
                    # We'll assign incremental seconds based on total
                    ts = datetime(2026, 8, 8, 15, 10, 0)
                    # add total seconds offset
                    from datetime import timedelta
                    ts = ts + timedelta(seconds=total)

                lat = parse_coordinate(row.get('GPS_Latitude',''))
                lon = parse_coordinate(row.get('GPS_Longitude',''))
                # Fallback: try already decimal?
                if lat is None:
                    try: lat = float(row.get('GPS_Latitude',''))
                    except: lat = None
                if lon is None:
                    try: lon = float(row.get('GPS_Longitude',''))
                    except: lon = None
                if lat is None or lon is None:
                    skipped += 1
                    continue
                try:
                    z = float(row.get('GPS_Altitude') or row.get('Elevation') or 0)
                except:
                    z = 0.0
                # Keep n/e as lat/lon for distance via haversine, but also store original for KML
                total += 1
                # Group key: use date from Time (08-08-2026)
                date_key = time_raw.split(' ')[0] if ' ' in time_raw else '08-08-2026'
                # Shift 1 for all (single dumper)
                data[date_key]['1'].append({'ts': ts, 'lat': lat, 'lon': lon, 'n': lat, 'e': lon, 'z': z, 'raw': row})
            except Exception as e:
                skipped += 1
                continue

        # Sort each shift chronologically
        for date in data:
            for sid in data[date]:
                data[date][sid].sort(key=lambda p: p['ts'])

        total_pts = sum(len(v) for d in data.values() for v in d.values())
        print(f"Loaded {total_pts} points across {len(data)} date(s) from {os.path.basename(input_csv)} ({skipped} rows skipped, {total} parsed)")
        return data

# ─────────────────────────────────────────────────────────────────────────────
# 2. Split contiguous paths (gap filter) — uses haversine
# ─────────────────────────────────────────────────────────────────────────────
def split_paths(points: list) -> list:
    paths, current = [], []
    for p in points:
        if not current:
            current.append(p)
            continue
        prev = current[-1]
        d = haversine_m(prev['lat'], prev['lon'], p['lat'], p['lon'])
        dt = (p['ts'] - prev['ts']).total_seconds()
        if d > MAX_DISTANCE_GAP_M or (0 < dt > MAX_TIME_GAP_SECONDS and dt < 86400):
            if len(current) > 1:
                paths.append(current)
            current = [p]
        else:
            current.append(p)
    if len(current) > 1:
        paths.append(current)
    return paths

# ─────────────────────────────────────────────────────────────────────────────
# 3. Smooth elevation
# ─────────────────────────────────────────────────────────────────────────────
def smooth_z(points: list) -> list:
    out, win = [], []
    for p in points:
        win.append(p['z'])
        if len(win) > SMOOTHING_WINDOW_SIZE:
            win.pop(0)
        q = p.copy()
        q['z_s'] = sum(win) / len(win)
        out.append(q)
    return out

# ─────────────────────────────────────────────────────────────────────────────
# 4. Segment path into Climb / Plan sections (same 2% threshold)
# ─────────────────────────────────────────────────────────────────────────────
def segment_path(pts: list) -> list:
    if len(pts) < 2:
        return []
    segs, cur = [], {'type': 'UNKNOWN', 'points': [pts[0]]}
    for i in range(1, len(pts)):
        p1, p2 = pts[i-1], pts[i]
        d = haversine_m(p1['lat'], p1['lon'], p2['lat'], p2['lon'])
        dz = abs(p2['z_s'] - p1['z_s'])
        g = dz / d if d > 0 else 0
        st = 'ELEVATION' if g > CLIMB_GRADIENT_THRESHOLD else 'PLAN'
        if cur['type'] == 'UNKNOWN':
            cur['type'] = st
        if st != cur['type']:
            segs.append(cur)
            cur = {'type': st, 'points': [p1, p2]}
        else:
            cur['points'].append(p2)
    segs.append(cur)
    return segs

# ─────────────────────────────────────────────────────────────────────────────
# 5. Write one shift's segments into KML sub-folders (same colors)
# ─────────────────────────────────────────────────────────────────────────────
def _line_style(color, width=1.5):
    s = simplekml.Style()
    s.linestyle.color = color
    s.linestyle.width = width
    return s

def populate_shift_folder(shift_folder, paths: list, shift_label: str):
    f_climbs = shift_folder.newfolder(name="Continuous Elevations")
    f_flats  = shift_folder.newfolder(name="Plan Paths (Roads)")
    f_bumps  = shift_folder.newfolder(name="Detected Bumps (Hazards)")

    s_green  = _line_style(simplekml.Color.green)
    s_yellow = _line_style(simplekml.Color.yellow)
    s_red    = _line_style(simplekml.Color.red)
    s_bump   = _line_style(simplekml.Color.green)

    idx = 0
    for pi, raw_path in enumerate(paths):
        smoothed = smooth_z(raw_path)
        for seg in segment_path(smoothed):
            pts = seg['points']
            if len(pts) < 2:
                continue

            total_dist = total_dz = 0.0
            coords = []
            for k, p in enumerate(pts):
                coords.append((p['lon'], p['lat'], RAISE_HEIGHT_M))
                if k > 0:
                    total_dist += haversine_m(pts[k-1]['lat'], pts[k-1]['lon'], p['lat'], p['lon'])
                    total_dz   += abs(p['z_s'] - pts[k-1]['z_s'])

            avg_grad = total_dz / total_dist if total_dist > 0 else 0.0

            if seg['type'] == 'ELEVATION':
                ls = f_climbs.newlinestring(name=f"{shift_label}_P{pi}_Climb{idx}")
                ls.coords       = coords
                ls.altitudemode = simplekml.AltitudeMode.relativetoground
                ls.extrude      = 1
                ls.style        = (s_red    if avg_grad > 0.10  else
                                   s_yellow if avg_grad > 0.0625 else s_green)
                ls.description  = (f"Shift: {shift_label}\n"
                                   f"Type: Continuous Climb\n"
                                   f"Length: {total_dist:.1f} m\n"
                                   f"Gradient: {avg_grad*100:.1f} %")
            else:
                ls = f_flats.newlinestring(name=f"{shift_label}_P{pi}_Flat{idx}")
                ls.coords       = coords
                ls.altitudemode = simplekml.AltitudeMode.relativetoground
                ls.style        = s_green
                ls.description  = f"Shift: {shift_label}\nType: Plan Path\nLength: {total_dist:.1f} m"

                b_dz = b_dist = 0.0
                b_start = 0
                for k in range(1, len(pts)):
                    d   = haversine_m(pts[k-1]['lat'], pts[k-1]['lon'], pts[k]['lat'], pts[k]['lon'])
                    z_u = pts[k]['z_s'] - pts[k-1]['z_s']
                    if z_u > 0:
                        b_dz   += z_u
                        b_dist += d
                    else:
                        b_dz = b_dist = 0.0
                        b_start = k
                    if b_dz > BUMP_HEIGHT_THRESHOLD_M and b_dist >= BUMP_MIN_LENGTH_M:
                        bcoords = []
                        for j in range(b_start, k+1):
                            bcoords.append((pts[j]['lon'], pts[j]['lat'], RAISE_HEIGHT_M + 2))
                        bm = f_bumps.newlinestring(name=f"BUMP_{shift_label}_{pi}_{k}")
                        bm.coords       = bcoords
                        bm.style        = s_bump
                        bm.altitudemode = simplekml.AltitudeMode.relativetoground
                        bm.description  = (f"Shift: {shift_label}\nHAZARD: Bump > 1 m\n"
                                           f"Height: {b_dz:.2f} m\nSpan: {b_dist:.1f} m")
                        b_dz = b_dist = 0.0
                        b_start = k
            idx += 1

# ─────────────────────────────────────────────────────────────────────────────
# 6. Build one combined KML per date
# ─────────────────────────────────────────────────────────────────────────────
def build_combined_kml(date_str: str, shifts_dict: dict, out_path: str):
    kml = simplekml.Kml(name=f"KIM Analysis – {date_str} (August 8 Dumper N10706)",
                        description="Gradient-colored haul road: green ≤6.25%, yellow 6.25–10%, red >10%. Select a Shift folder in Google Earth to toggle.")
    sorted_shifts = sorted(shifts_dict.keys(), key=lambda s: int(s) if s.isdigit() else 999)
    for shift_id in sorted_shifts:
        shift_label = f"Shift {shift_id}" if shift_id != "1" or len(sorted_shifts)>1 else "August 8 — N10706"
        points      = shifts_dict[shift_id]
        shift_folder = kml.newfolder(name=shift_label)
        shift_folder.visibility = 1
        paths = split_paths(points)
        print(f"  [{date_str} {shift_label}] {len(points)} pts -> {len(paths)} path(s)")
        if paths:
            populate_shift_folder(shift_folder, paths, shift_label)
        else:
            shift_folder.newpoint(name="No data", coords=[(0, 0, 0)]).visibility = 0
    kml.save(out_path)
    print(f"  [OK] Saved: {os.path.basename(out_path)}")

# ─────────────────────────────────────────────────────────────────────────────
# 7. Main
# ─────────────────────────────────────────────────────────────────────────────
def process(input_csv: str):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Output to same Output folder as original, plus to August 8 data folder for dashboard
    out_dir1   = os.path.join(script_dir, "Output_August8")
    out_dir2   = os.path.join(os.path.dirname(script_dir), "..", "August 8 data", "Output")
    # Also try alternative Vercel-safe path
    out_dir3   = os.path.join(os.path.dirname(script_dir), "..", "data", "august-8")
    for d in [out_dir1, out_dir2, out_dir3]:
        try:
            os.makedirs(d, exist_ok=True)
        except: pass

    data = load_and_group_august8(input_csv)

    for date_str, shifts_dict in sorted(data.items()):
        print(f"\nBuilding KML for {date_str} ({len(shifts_dict)} shift(s))...")
        safe_date = date_str.replace('-', '_').replace('/', '_').replace(' ', '_')
        # Primary output (next to script)
        out_path1  = os.path.join(out_dir1, f"KIM_August8_Gradient_{safe_date}.kml")
        build_combined_kml(date_str, shifts_dict, out_path1)
        # Secondary for dashboard linking (August 8 data/Output)
        try:
            out_path2 = os.path.join(out_dir2, f"KIM_August8_Gradient_{safe_date}.kml")
            build_combined_kml(date_str, shifts_dict, out_path2)
        except: pass
        try:
            out_path3 = os.path.join(out_dir3, f"KIM_August8_Gradient_{safe_date}.kml")
            build_combined_kml(date_str, shifts_dict, out_path3)
        except: pass
        # Also copy to fleet-dashboard for direct fetch
        try:
            dash_kml_dir = os.path.join(script_dir, "..", "data", "august-8")
            os.makedirs(dash_kml_dir, exist_ok=True)
            import shutil
            shutil.copy(out_path1, os.path.join(dash_kml_dir, f"KIM_August8_Gradient_{safe_date}.kml"))
        except: pass

    print(f"\nAll KML files saved to:\n  {out_dir1}\n  {out_dir2 if os.path.exists(out_dir2) else ''}\n  {out_dir3 if os.path.exists(out_dir3) else ''}")

if __name__ == '__main__':
    import argparse
    # Default to August 8 CSV next to this script's parent
    DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'August 8 data', 'RD20260808151024-HD785-7-N10706.csv')
    # Also try alternative data path
    alt = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'august-8', 'RD20260808151024-HD785-7-N10706.csv')
    if not os.path.exists(DEFAULT) and os.path.exists(alt):
        DEFAULT = alt
    p = argparse.ArgumentParser(description='KIM August 8 Gradient KML Generator (same logic as kim_combined.py)')
    p.add_argument('--input', default=DEFAULT, help='Path to August 8 CSV')
    args = p.parse_args()
    # Resolve to absolute and handle spaces
    inp = os.path.abspath(args.input)
    if not os.path.exists(inp):
        # Try with August 8 data folder name with space
        cand = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'August 8 data', 'RD20260808151024-HD785-7-N10706.csv')
        if os.path.exists(cand):
            inp = cand
    print(f"Input: {inp}")
    process(inp)
