/* ============================================================
   charts.js — graphiques SVG purs (aucune dépendance)
   barres · ligne/aire · donut · heatmap
   Style : axes discrets, chiffres tabulaires, palette maîtrisée.
   ============================================================ */

const AXIS = 'var(--c-text-3)';
const GRID = 'var(--c-border)';

function niceMax(v) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Barres verticales. data: [{label, value, color?}] */
export function barChart(data, { height = 160, unit = '', format = (v) => v } = {}) {
  const W = 640, H = height, padL = 44, padB = 26, padT = 12, padR = 8;
  const max = niceMax(Math.max(...data.map(d => d.value), 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const bw = Math.min(34, (iw / data.length) * 0.62);
  const step = iw / data.length;

  const grid = [0, 0.5, 1].map(f => {
    const y = padT + ih * (1 - f);
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>
      <text x="${padL - 6}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="${AXIS}">${format(max * f)}</text>`;
  }).join('');

  const bars = data.map((d, i) => {
    const h = Math.max(1.5, (d.value / max) * ih);
    const x = padL + i * step + (step - bw) / 2;
    const y = padT + ih - h;
    const fill = d.color || 'var(--c-accent)';
    return `<g>
      <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${fill}">
        <title>${d.label} : ${format(d.value)}${unit}</title></rect>
      <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="${AXIS}">${d.label}</text>
    </g>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique en barres">${grid}${bars}</svg>`;
}

/** Ligne + aire. series: [{label, values:[..]}], labels: [..] */
export function lineChart(labels, series, { height = 170, unit = '', format = (v) => v } = {}) {
  const W = 640, H = height, padL = 40, padB = 26, padT = 12, padR = 12;
  const all = series.flatMap(s => s.values);
  const max = niceMax(Math.max(...all, 1));
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = i => padL + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = v => padT + ih * (1 - v / max);

  const grid = [0, 0.5, 1].map(f => {
    const gy = padT + ih * (1 - f);
    return `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="${GRID}" stroke-width="1"/>
      <text x="${padL - 6}" y="${gy + 3.5}" text-anchor="end" font-size="10" fill="${AXIS}">${format(max * f)}</text>`;
  }).join('');

  const lines = series.map((s, si) => {
    const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const area = `${padL},${padT + ih} ${pts} ${x(s.values.length - 1)},${padT + ih}`;
    const color = s.color || (si === 0 ? 'var(--c-accent)' : 'var(--c-text-3)');
    return `${s.dashed ? '' : `<polygon points="${area}" fill="${color}" opacity="0.08"/>`}
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="5 5"' : ''}/>
      ${s.values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="2.6" fill="${color}"><title>${labels[i]} : ${format(v)}${unit}</title></circle>`).join('')}`;
  }).join('');

  const xlabels = labels.map((l, i) =>
    (labels.length > 8 && i % 2 === 1) ? '' :
    `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="${AXIS}">${l}</text>`
  ).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique en ligne">${grid}${lines}${xlabels}</svg>`;
}

/** Donut. segments: [{label, value, color}] */
export function donutChart(segments, { size = 170, centerLabel = '', centerValue = '' } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 62, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / total;
    const dash = `${frac * C} ${C}`;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color || 'var(--c-accent)'}"
      stroke-width="17" stroke-dasharray="${dash}" stroke-dashoffset="${-offset * C}"
      transform="rotate(-90 ${cx} ${cy})"><title>${s.label}</title></circle>`;
    offset += frac;
    return el;
  }).join('');
  return `<svg class="chart chart-donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="Répartition">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--c-surface-2)" stroke-width="17"/>
    ${arcs}
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--c-text)">${centerValue}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="10" fill="var(--c-text-3)">${centerLabel}</text>
  </svg>`;
}

/** Heatmap GitHub-style. days: [{date, value 0-4}] (colonnes = semaines, lundi en bas). */
export function heatmap(days, { cell = 13, gap = 3, palette = ['var(--c-surface-2)', '#D8D4F4', '#B3A9EC', '#8474DE', '#5E6AD2'] } = {}) {
  if (!days.length) return '';
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const W = weeks.length * (cell + gap) + 2;
  const H = 7 * (cell + gap) + 2;
  const cells = weeks.map((week, wi) => week.map((d, di) => {
    const dow = new Date(d.date + 'T12:00:00').getDay(); // 0 dim
    const row = (dow + 6) % 7; // lundi = 0
    return `<rect x="${wi * (cell + gap)}" y="${row * (cell + gap)}" width="${cell}" height="${cell}" rx="2.5"
      fill="${palette[d.value] ?? palette[0]}"><title>${d.date} · ${d.minutes} min</title></rect>`;
  }).join('')).join('');
  return `<svg class="chart chart-heatmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Régularité">${cells}</svg>`;
}

/** Mini barres (sparkline) pour les vues mois/année. values: [..] */
export function sparkbars(values, { width = 120, height = 32, color = 'var(--c-accent)' } = {}) {
  const max = Math.max(...values, 1);
  const bw = width / values.length - 2;
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendance">
    ${values.map((v, i) => {
      const h = Math.max(2, (v / max) * (height - 4));
      return `<rect x="${i * (bw + 2)}" y="${height - h}" width="${bw}" height="${h}" rx="1.5" fill="${color}" opacity="${0.45 + 0.55 * (v / max)}"></rect>`;
    }).join('')}
  </svg>`;
}
