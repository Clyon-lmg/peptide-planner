/**
 * Google Play Store asset generator
 * Outputs to store-assets/:
 *   icon-512.png           — 512×512 app icon
 *   feature-graphic.png    — 1024×500 feature graphic
 *   phone-{1-4}-*.png      — 1080×1920 phone screenshots
 *   tablet7-{1-4}-*.png    — 1200×1920 7-inch tablet screenshots
 *   tablet10-{1-4}-*.png   — 2560×1600 10-inch tablet screenshots (landscape)
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'store-assets');
await mkdir(OUT, { recursive: true });

// ── Palette ──────────────────────────────────────────────────────────────────
const BG      = '#0f172a';
const CARD    = '#1e293b';
const BORDER  = '#334155';
const TEXT    = '#f1f5f9';
const MUTED   = '#64748b';
const MUTED2  = '#94a3b8';
const PRIMARY = '#6366f1';
const CYAN    = '#38bdf8';
const TEAL    = '#0d9488';
const EMERALD = '#10b981';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const INNER   = '#16213a';   // inner card bg (replaces semi-transparent)

// ── SVG primitives ───────────────────────────────────────────────────────────
const e = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function rect(x, y, w, h, rx = 0, fill = 'transparent', stroke = null, sw = 2) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${
    stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
}

function t(x, y, str, size, fill, anchor = 'start', weight = 'normal') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" font-family="Arial,Helvetica,sans-serif">${e(String(str))}</text>`;
}

function circle(cx, cy, r, fill, stroke = null, sw = 2) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${
    stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
}

function line(x1, y1, x2, y2, stroke, sw = 2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function progressBar(x, y, w, pct, color, h = 12) {
  const fill = Math.max(h, w * Math.min(1, pct));
  return rect(x, y, w, h, h / 2, BORDER) +
         rect(x, y, fill, h, h / 2, color);
}

// ── Flask icon (reusable) ────────────────────────────────────────────────────
function flask(cx, cy, r) {
  const nr = r * 0.14;  // neck half-width
  const nh = r * 0.44;  // neck height
  const ny = cy - r * 0.42;
  const bw = r * 0.52;  // body half-width at base
  const by = cy + r * 0.5; // body base y
  const liqY = cy + r * 0.22;
  return [
    `<rect x="${cx - nr}" y="${ny}" width="${nr * 2}" height="${nh}" rx="${nr * 0.6}" fill="white"/>`,
    `<path d="M${cx - nr} ${ny + nh} L${cx - bw} ${by} Q${cx - bw - r * 0.06} ${by + r * 0.14} ${cx - bw + r * 0.1} ${by + r * 0.14} L${cx + bw - r * 0.1} ${by + r * 0.14} Q${cx + bw + r * 0.06} ${by + r * 0.14} ${cx + bw} ${by} L${cx + nr} ${ny + nh} Z" fill="white"/>`,
    `<path d="M${cx - bw * 0.7} ${liqY} L${cx - bw} ${by} Q${cx - bw - r * 0.06} ${by + r * 0.14} ${cx - bw + r * 0.1} ${by + r * 0.14} L${cx + bw - r * 0.1} ${by + r * 0.14} Q${cx + bw + r * 0.06} ${by + r * 0.14} ${cx + bw} ${by} L${cx + bw * 0.7} ${liqY} Z" fill="${CYAN}" opacity="0.45"/>`,
    circle(cx - r * 0.12, cy + r * 0.38, r * 0.06, 'white', null, 0) + 'fill-opacity="0.5"',
    circle(cx + r * 0.1, cy + r * 0.3, r * 0.04, 'white', null, 0),
  ].join('');
}

// ── Tab bar icons (SVG paths) ────────────────────────────────────────────────
function tabIcon(cx, cy, id, active) {
  const c = active ? PRIMARY : MUTED2;
  const s = 26; // icon size
  switch (id) {
    case 'today':
      return `<path d="M${cx} ${cy - s} L${cx + s} ${cy + s * 0.3} L${cx + s * 0.55} ${cy + s * 0.3} L${cx + s * 0.55} ${cy + s} L${cx - s * 0.55} ${cy + s} L${cx - s * 0.55} ${cy + s * 0.3} L${cx - s} ${cy + s * 0.3} Z" fill="${c}"/>` +
             rect(cx - s * 0.3, cy + s * 0.1, s * 0.6, s * 0.9, 4, active ? BG : CARD);
    case 'calendar':
      return rect(cx - s, cy - s * 0.6, s * 2, s * 1.6, 7, 'none', c, 4) +
             line(cx - s + 6, cy - s * 0.6, cx - s + 6, cy - s, c, 5) +
             line(cx + s - 6, cy - s * 0.6, cx + s - 6, cy - s, c, 5) +
             line(cx - s, cy - s * 0.1, cx + s, cy - s * 0.1, c, 3) +
             rect(cx - s * 0.5, cy + s * 0.05, s * 0.4, s * 0.4, 3, c) +
             rect(cx + s * 0.1, cy + s * 0.05, s * 0.4, s * 0.4, 3, c);
    case 'protocols':
      return line(cx - s, cy - s * 0.55, cx + s, cy - s * 0.55, c, 5) +
             line(cx - s, cy, cx + s, cy, c, 5) +
             line(cx - s, cy + s * 0.55, cx + s * 0.2, cy + s * 0.55, c, 5);
    case 'inventory':
      return rect(cx - s, cy - s * 0.15, s * 2, s * 1.15, 5, c) +
             `<path d="M${cx - s + 6} ${cy - s * 0.15} L${cx - s + 6} ${cy - s * 0.65} L${cx + s - 6} ${cy - s * 0.65} L${cx + s - 6} ${cy - s * 0.15}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
    case 'settings': {
      const pts = Array.from({length: 8}, (_, i) => {
        const a = (i * 45) * Math.PI / 180;
        return `<line x1="${cx + (s - 8) * Math.cos(a)}" y1="${cy + (s - 8) * Math.sin(a)}" x2="${cx + (s + 6) * Math.cos(a)}" y2="${cy + (s + 6) * Math.sin(a)}" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`;
      }).join('');
      return pts + circle(cx, cy, s * 0.42, 'none', c, 4);
    }
    default:
      return circle(cx, cy, s, c);
  }
}

// ── Status bar ───────────────────────────────────────────────────────────────
function statusBar(W) {
  return rect(0, 0, W, 90, 0, BG) +
    t(48, 63, '9:41', 42, TEXT, 'start', 'bold') +
    // signal
    rect(W - 186, 44, 9, 20, 2, MUTED2) +
    rect(W - 174, 36, 9, 28, 2, MUTED2) +
    rect(W - 162, 28, 9, 36, 2, MUTED2) +
    // battery
    rect(W - 138, 28, 72, 36, 6, 'none', MUTED2, 3) +
    rect(W - 135, 31, 52, 30, 4, EMERALD) +
    rect(W - 66, 36, 6, 22, 3, MUTED2);
}

// ── Tab bar (phone / tablet portrait) ───────────────────────────────────────
function tabBar(activeTab, W, Y = 1752, H = 168) {
  const tabs = ['today','calendar','protocols','inventory','settings'];
  const labels = { today:'Today', calendar:'Calendar', protocols:'Protocols', inventory:'Inventory', settings:'Settings' };
  const tabW = W / tabs.length;
  let svg = rect(0, Y, W, H, 0, CARD) + line(0, Y, W, Y, BORDER, 1.5);
  tabs.forEach((id, i) => {
    const cx = tabW * i + tabW / 2;
    const active = id === activeTab;
    svg += tabIcon(cx, Y + 48, id, active);
    svg += t(cx, Y + 134, labels[id], 30, active ? PRIMARY : MUTED, 'middle', active ? 'bold' : 'normal');
  });
  return svg;
}

// ── Dose card ────────────────────────────────────────────────────────────────
function doseCard(x, y, w, name, dose, site, status, time = null) {
  const h = 156;
  const taken = status === 'TAKEN';
  const cbX = x + w - 96, cbY = y + h / 2;
  let s = rect(x, y, w, h, 36, CARD, BORDER, 2);
  if (taken) {
    s += circle(cbX, cbY, 36, EMERALD);
    s += `<path d="M${cbX - 18} ${cbY + 2} L${cbX - 5} ${cbY + 16} L${cbX + 18} ${cbY - 14}" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    s += circle(cbX, cbY, 36, 'none', BORDER, 4);
  }
  const tc = taken ? MUTED : TEXT;
  s += t(x + 54, y + 60, name, 46, tc, 'start', 'bold');
  if (taken) s += line(x + 54, y + 48, x + 54 + name.length * 24, y + 48, MUTED, 3);
  const details = [dose + ' mg', site, time].filter(Boolean).join(' · ');
  s += t(x + 54, y + 112, details, 36, MUTED);
  return s;
}

// ── Calendar dose row ────────────────────────────────────────────────────────
function calDoseRow(x, y, w, name, dose, site, status) {
  const h = 142;
  const statusBg  = { TAKEN: EMERALD, SKIPPED: MUTED, PENDING: PRIMARY + '33' };
  const statusTxt = { TAKEN: 'Taken',  SKIPPED: 'Skipped', PENDING: 'Pending' };
  const label = statusTxt[status];
  const badgeW = label.length * 18 + 52;
  let s = rect(x, y, w, h, 30, CARD, BORDER, 2);
  s += rect(x + w - badgeW - 40, y + h / 2 - 24, badgeW, 48, 24, statusBg[status]);
  s += t(x + w - badgeW / 2 - 40, y + h / 2 + 12, label, 30, 'white', 'middle', 'bold');
  s += t(x + 48, y + 54, name, 46, status === 'TAKEN' ? MUTED : TEXT, 'start', 'bold');
  s += t(x + 48, y + 102, `${dose} mg · ${site}`, 36, MUTED);
  return s;
}

// ── Protocol card ────────────────────────────────────────────────────────────
function protocolCard(x, y, w, name, started, items) {
  const ITEM_H = 120, GAP = 24;
  const h = 114 + items.length * ITEM_H + (items.length - 1) * GAP + 48;
  let s = rect(x, y, w, h, 36, CARD, BORDER, 2);
  s += line(x, y + 90, x + w, y + 90, BORDER, 1.5);
  s += t(x + 48, y + 58, name, 52, TEXT, 'start', 'bold');
  s += t(x + 48, y + 84, `Started ${started} · ongoing`, 30, MUTED);
  items.forEach((item, i) => {
    const iy = y + 114 + i * (ITEM_H + GAP);
    s += rect(x + 24, iy, w - 48, ITEM_H, 22, INNER, BORDER, 1.5);
    s += t(x + 68, iy + 46, item.name, 42, TEXT, 'start', 'bold');
    s += t(x + 68, iy + 86, [item.schedule, item.time].filter(Boolean).join(' · '), 32, MUTED);
    s += t(x + w - 68, iy + 46, item.dose, 42, PRIMARY, 'end', 'bold');
  });
  return s;
}

// ── Inventory vial card ──────────────────────────────────────────────────────
function vialCard(x, y, w, name, remaining, total, vials, mgPerVial, bac) {
  const pct = total > 0 ? remaining / total : 0;
  const color = pct <= 0.1 ? RED : pct <= 0.25 ? AMBER : EMERALD;
  let s = rect(x, y, w, 180, 30, CARD, BORDER, 2);
  s += t(x + 48, y + 62, name, 48, TEXT, 'start', 'bold');
  s += t(x + w - 48, y + 62, `${vials} vial${vials !== 1 ? 's' : ''}`, 36, color, 'end', '600');
  s += progressBar(x + 48, y + 90, w - 96, pct, color, 16);
  const details = [`${remaining.toFixed(1)} / ${total.toFixed(0)} mg`, `${mgPerVial}mg/vial`, bac ? `${bac}mL BAC` : null].filter(Boolean).join(' · ');
  s += t(x + 48, y + 150, details, 34, MUTED);
  return s;
}

// ── Inventory capsule card ───────────────────────────────────────────────────
function capsuleCard(x, y, w, name, remCaps, totalCaps, mgPerCap) {
  const pct = totalCaps > 0 ? remCaps / totalCaps : 0;
  const color = pct <= 0.1 ? RED : pct <= 0.25 ? AMBER : EMERALD;
  let s = rect(x, y, w, 180, 30, CARD, BORDER, 2);
  s += t(x + 48, y + 62, name, 48, TEXT, 'start', 'bold');
  s += t(x + w - 48, y + 62, `${remCaps} caps`, 36, color, 'end', '600');
  s += progressBar(x + 48, y + 90, w - 96, pct, color, 16);
  s += t(x + 48, y + 150, `${remCaps} / ${totalCaps} caps · ${mgPerCap}mg/cap`, 34, MUTED);
  return s;
}

// ── Week strip ───────────────────────────────────────────────────────────────
function weekStrip(x, y, W, days, selectedIdx) {
  const dayW = W / 7;
  return days.map(({ label, date }, i) => {
    const cx = x + dayW * i + dayW / 2;
    const sel = i === selectedIdx;
    return t(cx, y + 36, label, 30, MUTED, 'middle') +
      (sel
        ? circle(cx, y + 88, 42, PRIMARY) + t(cx, y + 103, date, 38, 'white', 'middle', 'bold')
        : t(cx, y + 103, date, 38, TEXT, 'middle', 'normal'));
  }).join('');
}

// ── Low-stock warning banner ─────────────────────────────────────────────────
function lowStockBanner(x, y, w) {
  return rect(x, y, w, 160, 24, '#78350f33', '#b4530044', 2) +
    t(x + 48, y + 68, '[!] Low inventory', 42, AMBER, 'start', 'bold') +
    t(x + 48, y + 120, 'TB-500: 3 doses remaining · reorder by Mar 15', 36, '#fcd34d');
}

// ── Section chip label ───────────────────────────────────────────────────────
function chipLabel(x, y, label) {
  return t(x, y, label, 34, PRIMARY, 'start', '700');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE SCREENS  1080 × 1920
// ═══════════════════════════════════════════════════════════════════════════════
const PW = 1080, PH = 1920, PP = 48;

function svgOpen(W, H, extraDefs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${extraDefs}</defs>${rect(0, 0, W, H, 0, BG)}`;
}

const WEEK_DAYS = [
  { label:'MON', date:'3' }, { label:'TUE', date:'4' }, { label:'WED', date:'5' },
  { label:'THU', date:'6' }, { label:'FRI', date:'7' }, { label:'SAT', date:'8' },
  { label:'SUN', date:'9' },
];

function phoneToday(W = PW, H = PH, P = PP) {
  const CW = W - P * 2;
  return svgOpen(W, H) +
    statusBar(W) +
    t(P, 180, 'Today', 84, TEXT, 'start', 'bold') +
    t(P, 234, 'Monday, March 9th', 42, MUTED) +
    doseCard(P, 288, CW, 'BPC-157',    '0.25', 'Abdomen', 'TAKEN',   'AM') +
    doseCard(P, 468, CW, 'TB-500',     '2.50', 'Thigh',   'PENDING', 'PM') +
    doseCard(P, 648, CW, 'Semaglutide','0.50', 'Abdomen', 'TAKEN',   'AM') +
    doseCard(P, 828, CW, 'BPC-157 (PM)','0.25','Abdomen', 'PENDING', 'PM') +
    tabBar('today', W) +
    '</svg>';
}

function phoneCalendar(W = PW, H = PH, P = PP) {
  const CW = W - P * 2;
  return svgOpen(W, H) +
    statusBar(W) +
    t(P, 172, 'March 2026', 72, TEXT, 'start', 'bold') +
    // nav arrows
    rect(W - 210, 108, 80, 80, 16, CARD) +
    `<path d="M${W-178} 135 L${W-196} 148 L${W-178} 161" fill="none" stroke="${MUTED2}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    rect(W - 124, 108, 80, 80, 16, CARD) +
    `<path d="M${W-106} 135 L${W-88} 148 L${W-106} 161" fill="none" stroke="${MUTED2}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    weekStrip(0, 192, W, WEEK_DAYS, 6) +
    line(0, 330, W, 330, BORDER, 1.5) +
    t(P, 406, "Today's Doses", 54, TEXT, 'start', 'bold') +
    calDoseRow(P, 430, CW, 'BPC-157',     '0.25', 'Abdomen · AM', 'TAKEN') +
    calDoseRow(P, 596, CW, 'TB-500',      '2.50', 'Thigh · PM',   'TAKEN') +
    calDoseRow(P, 762, CW, 'Semaglutide', '0.50', 'Abdomen · AM', 'PENDING') +
    calDoseRow(P, 928, CW, 'BPC-157 (PM)','0.25', 'Abdomen · PM', 'PENDING') +
    tabBar('calendar', W) +
    '</svg>';
}

function phoneProtocols(W = PW, H = PH, P = PP) {
  const CW = W - P * 2;
  return svgOpen(W, H) +
    statusBar(W) +
    t(P, 180, 'Protocols', 84, TEXT, 'start', 'bold') +
    t(P, 234, 'Active dosing protocols', 42, MUTED) +
    protocolCard(P, 288, CW, 'Recovery Stack', 'Jan 15, 2026', [
      { name:'BPC-157',   dose:'0.25 mg', schedule:'Every day',       time:'AM'   },
      { name:'TB-500',    dose:'2.50 mg', schedule:'Mon, Wed, Fri',   time: null  },
    ]) +
    protocolCard(P, 762, CW, 'Weight Protocol', 'Feb 1, 2026', [
      { name:'Semaglutide', dose:'0.50 mg', schedule:'Every 7 days', time: null },
      { name:'Tirzepatide', dose:'5.00 mg', schedule:'Every 7 days', time: null },
    ]) +
    tabBar('protocols', W) +
    '</svg>';
}

function phoneInventory(W = PW, H = PH, P = PP) {
  const CW = W - P * 2;
  return svgOpen(W, H) +
    statusBar(W) +
    t(P, 180, 'Inventory', 84, TEXT, 'start', 'bold') +
    t(P, 234, 'Current stock levels', 42, MUTED) +
    chipLabel(P, 306, 'VIALS') +
    vialCard(P, 318, CW, 'BPC-157',  14.2, 18.0, 2, 9,  2) +
    vialCard(P, 516, CW, 'TB-500',   11.0, 50.0, 1, 50, 2) +
    chipLabel(P, 738, 'CAPSULES') +
    capsuleCard(P, 750, CW, 'Semaglutide', 19, 30, 1) +
    capsuleCard(P, 948, CW, 'Tirzepatide',  8, 30, 5) +
    tabBar('inventory', W) +
    '</svg>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7-INCH TABLET  1200 × 1920  (portrait — same layout, slightly wider)
// ═══════════════════════════════════════════════════════════════════════════════
const T7W = 1200, T7H = 1920, T7P = 60;

function tablet7Today()      { return phoneToday     (T7W, T7H, T7P); }
function tablet7Calendar()   { return phoneCalendar  (T7W, T7H, T7P); }
function tablet7Protocols()  { return phoneProtocols (T7W, T7H, T7P); }
function tablet7Inventory()  { return phoneInventory (T7W, T7H, T7P); }

// ═══════════════════════════════════════════════════════════════════════════════
// 10-INCH TABLET  2560 × 1600  (landscape, sidebar + content)
// ═══════════════════════════════════════════════════════════════════════════════
const T10W = 2560, T10H = 1600, T10P = 64, SIDE = 560;

const ICON_GRAD = `<linearGradient id="ig" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" stop-color="${CYAN}"/>
  <stop offset="100%" stop-color="${TEAL}"/>
</linearGradient>`;

function t10StatusBar() {
  return rect(0, 0, T10W, 78, 0, BG) +
    t(40, 54, '9:41', 40, TEXT, 'start', 'bold') +
    rect(T10W-130, 22, 68, 34, 5, 'none', MUTED2, 2.5) +
    rect(T10W-127, 25, 50, 28, 3, EMERALD) +
    rect(T10W-62,  30, 6,  22, 3, MUTED2) +
    rect(T10W-186, 34, 8, 18, 2, MUTED2) +
    rect(T10W-175, 26, 8, 26, 2, MUTED2) +
    rect(T10W-164, 18, 8, 34, 2, MUTED2);
}

function sidebar(activeId) {
  const tabs = ['today','calendar','protocols','inventory','settings'];
  const labels = { today:'Today', calendar:'Calendar', protocols:'Protocols', inventory:'Inventory', settings:'Settings' };
  let s = rect(0, 0, SIDE, T10H, 0, CARD) + line(SIDE, 0, SIDE, T10H, BORDER, 1.5);
  // Logo
  s += circle(78, 120, 48, 'url(#ig)');
  s += flask(78, 120, 48);
  s += t(142, 108, 'Peptide', 46, TEXT,  'start', '800');
  s += t(142, 152, 'Planner', 46, CYAN,  'start', '800');
  tabs.forEach((id, i) => {
    const ty = 248 + i * 108;
    const active = id === activeId;
    if (active) s += rect(12, ty - 4, SIDE - 24, 82, 16, PRIMARY + '1a', PRIMARY, 1.5);
    s += tabIcon(72, ty + 34, id, active);
    s += t(128, ty + 50, labels[id], 42, active ? PRIMARY : MUTED2, 'start', active ? 'bold' : 'normal');
  });
  return s;
}

function t10Open(activeTab) {
  return svgOpen(T10W, T10H, ICON_GRAD) + t10StatusBar() + sidebar(activeTab);
}

function cx() { return SIDE + T10P; }    // content start x
function cw() { return T10W - SIDE - T10P * 2; }  // content width
function col1x() { return cx(); }
function col2x() { return cx() + cw() / 2 + T10P / 2; }
function colW()  { return cw() / 2 - T10P / 2; }

function tablet10Today() {
  const CX = cx(), CW = cw(), C1 = col1x(), C2 = col2x(), CL = colW();
  return t10Open('today') +
    t(CX, 154, 'Today', 76, TEXT, 'start', 'bold') +
    t(CX, 204, 'Monday, March 9th', 40, MUTED) +
    doseCard(C1, 270, CL, 'BPC-157',      '0.25', 'Abdomen', 'TAKEN',   'AM') +
    doseCard(C2, 270, CL, 'TB-500',       '2.50', 'Thigh',   'PENDING', 'PM') +
    doseCard(C1, 450, CL, 'Semaglutide',  '0.50', 'Abdomen', 'TAKEN',   'AM') +
    doseCard(C2, 450, CL, 'BPC-157 (PM)', '0.25', 'Abdomen', 'PENDING', 'PM') +
    // Summary bar
    rect(CX, 660, CW, 190, 28, CARD, BORDER, 2) +
    t(CX + T10P, 724, "Today's Progress", 46, TEXT, 'start', 'bold') +
    t(CX + T10P, 770, '2 of 4 doses taken', 36, MUTED) +
    progressBar(CX + T10P, 800, CW - T10P * 2, 0.5, PRIMARY, 18) +
    '</svg>';
}

function tablet10Calendar() {
  const CX = cx(), CW = cw(), C1 = col1x(), C2 = col2x(), CL = colW();
  return t10Open('calendar') +
    t(CX, 152, 'March 2026', 66, TEXT, 'start', 'bold') +
    rect(CX + CW - 184, 96, 76, 76, 14, CARD) +
    `<path d="M${CX+CW-158} 120 L${CX+CW-174} 134 L${CX+CW-158} 148" fill="none" stroke="${MUTED2}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    rect(CX + CW - 102, 96, 76, 76, 14, CARD) +
    `<path d="M${CX+CW-88} 120 L${CX+CW-72} 134 L${CX+CW-88} 148" fill="none" stroke="${MUTED2}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    weekStrip(CX, 162, CW, WEEK_DAYS, 6) +
    line(CX, 304, CX + CW, 304, BORDER, 1.5) +
    t(CX, 372, "Today's Doses", 52, TEXT, 'start', 'bold') +
    calDoseRow(C1, 394, CL, 'BPC-157',      '0.25', 'Abdomen · AM', 'TAKEN') +
    calDoseRow(C2, 394, CL, 'TB-500',       '2.50', 'Thigh · PM',   'TAKEN') +
    calDoseRow(C1, 552, CL, 'Semaglutide',  '0.50', 'Abdomen · AM', 'PENDING') +
    calDoseRow(C2, 552, CL, 'BPC-157 (PM)', '0.25', 'Abdomen · PM', 'PENDING') +
    '</svg>';
}

function tablet10Protocols() {
  const CX = cx(), C1 = col1x(), C2 = col2x(), CL = colW();
  return t10Open('protocols') +
    t(CX, 154, 'Protocols', 76, TEXT, 'start', 'bold') +
    t(CX, 204, 'Active dosing protocols', 40, MUTED) +
    protocolCard(C1, 258, CL, 'Recovery Stack', 'Jan 15, 2026', [
      { name:'BPC-157', dose:'0.25 mg', schedule:'Every day',     time:'AM'  },
      { name:'TB-500',  dose:'2.50 mg', schedule:'Mon, Wed, Fri', time: null },
    ]) +
    protocolCard(C2, 258, CL, 'Weight Protocol', 'Feb 1, 2026', [
      { name:'Semaglutide', dose:'0.50 mg', schedule:'Every 7 days', time: null },
      { name:'Tirzepatide', dose:'5.00 mg', schedule:'Every 7 days', time: null },
    ]) +
    '</svg>';
}

function tablet10Inventory() {
  const CX = cx(), C1 = col1x(), C2 = col2x(), CL = colW();
  return t10Open('inventory') +
    t(CX, 154, 'Inventory', 76, TEXT, 'start', 'bold') +
    t(CX, 204, 'Current stock levels', 40, MUTED) +
    chipLabel(C1, 278, 'VIALS') +
    vialCard(C1, 294, CL, 'BPC-157', 14.2, 18.0, 2, 9,  2) +
    vialCard(C1, 494, CL, 'TB-500',  11.0, 50.0, 1, 50, 2) +
    chipLabel(C2, 278, 'CAPSULES') +
    capsuleCard(C2, 294, CL, 'Semaglutide', 19, 30, 1) +
    capsuleCard(C2, 494, CL, 'Tirzepatide',  8, 30, 5) +
    '</svg>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE GRAPHIC  1024 × 500
// ═══════════════════════════════════════════════════════════════════════════════
function featureGraphic() {
  const W = 1024, H = 500, iX = 188, iY = 250, iR = 142;
  const defs = `
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1629"/><stop offset="100%" stop-color="#0a1a30"/>
    </linearGradient>
    <linearGradient id="ig" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${CYAN}"/><stop offset="100%" stop-color="${TEAL}"/>
    </linearGradient>
    <linearGradient id="fade" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${TEAL}" stop-opacity="0"/>
    </linearGradient>`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${defs}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  // subtle grid
  for (let i = 0; i <= 9; i++) s += line(0, i * 56, W, i * 56, PRIMARY, 0.4) ;
  for (let i = 0; i <= 17; i++) s += line(i * 64, 0, i * 64, H, PRIMARY, 0.4);
  // glow
  s += `<circle cx="${iX}" cy="${iY}" r="260" fill="${CYAN}" opacity="0.04"/>`;
  s += `<circle cx="${iX}" cy="${iY}" r="180" fill="${CYAN}" opacity="0.05"/>`;
  // icon
  s += circle(iX, iY, iR, 'url(#ig)');
  s += flask(iX, iY, iR);
  // accent line
  s += `<rect x="${iX + iR + 18}" y="${iY - 4}" width="${W}" height="8" rx="4" fill="url(#fade)"/>`;
  // name
  s += t(iX + iR + 36, iY - 44, 'Peptide', 82, 'white', 'start', '800');
  s += t(iX + iR + 36, iY + 58, 'Planner', 82, CYAN,    'start', '800');
  s += t(iX + iR + 38, iY + 108, 'Track · Schedule · Stay on protocol', 30, MUTED2);
  s += '</svg>';
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER ALL ASSETS
// ═══════════════════════════════════════════════════════════════════════════════
async function render(filename, svgStr) {
  const dest = join(OUT, filename);
  await sharp(Buffer.from(svgStr)).png().toFile(dest);
  console.log(`  ✓ ${filename}`);
}

// App icon — resize existing 1024×1024 asset
await sharp(join(ROOT, 'mobile/assets/icon.png'))
  .resize(512, 512)
  .png()
  .toFile(join(OUT, 'icon-512.png'));
console.log('  ✓ icon-512.png');

const assets = [
  ['feature-graphic.png',       featureGraphic()],
  ['phone-1-today.png',         phoneToday()],
  ['phone-2-calendar.png',      phoneCalendar()],
  ['phone-3-protocols.png',     phoneProtocols()],
  ['phone-4-inventory.png',     phoneInventory()],
  ['tablet7-1-today.png',       tablet7Today()],
  ['tablet7-2-calendar.png',    tablet7Calendar()],
  ['tablet7-3-protocols.png',   tablet7Protocols()],
  ['tablet7-4-inventory.png',   tablet7Inventory()],
  ['tablet10-1-today.png',      tablet10Today()],
  ['tablet10-2-calendar.png',   tablet10Calendar()],
  ['tablet10-3-protocols.png',  tablet10Protocols()],
  ['tablet10-4-inventory.png',  tablet10Inventory()],
];

for (const [name, svg] of assets) {
  await render(name, svg);
}

console.log(`\n✅  ${assets.length + 1} assets written to store-assets/`);
