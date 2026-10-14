type Theme = { bg: string; fg: string; accent: string };

// 8 tông màu lấy theo giao diện dự án (nền tối + đỏ Avalanche, vàng, xanh, tím...)
const THEMES: Theme[] = [
  { bg: '#1a0a0c', fg: '#e84142', accent: '#ffd166' }, // red
  { bg: '#17110a', fg: '#f5b301', accent: '#ff7a59' }, // amber
  { bg: '#07140e', fg: '#22c55e', accent: '#a7f3d0' }, // green
  { bg: '#06121a', fg: '#22d3ee', accent: '#e0f2fe' }, // cyan
  { bg: '#120a1c', fg: '#a855f7', accent: '#f0abfc' }, // purple
  { bg: '#1a0f08', fg: '#fb923c', accent: '#fde68a' }, // orange
  { bg: '#1a0912', fg: '#f472b6', accent: '#fbcfe8' }, // pink
  { bg: '#080d1c', fg: '#3b82f6', accent: '#93c5fd' }, // blue
];

// 16 mẫu pixel 5x5, mỗi hàng 3 ký tự (nửa trái + cột giữa), tự lật đối xứng
const PATTERNS: string[][] = [
  ['101', '111', '010', '111', '101'],
  ['010', '111', '111', '010', '101'],
  ['111', '101', '111', '001', '101'],
  ['001', '111', '101', '111', '100'],
  ['110', '011', '111', '011', '110'],
  ['010', '101', '111', '101', '010'],
  ['111', '010', '111', '010', '111'],
  ['100', '111', '010', '111', '001'],
  ['011', '111', '110', '111', '011'],
  ['101', '010', '111', '010', '101'],
  ['111', '111', '010', '101', '101'],
  ['010', '010', '111', '111', '101'],
  ['110', '101', '011', '101', '110'],
  ['001', '101', '111', '101', '001'],
  ['111', '001', '111', '100', '111'],
  ['011', '101', '010', '101', '011'],
];

function toDataUri(p: string[], t: Theme): string {
  let cells = '';
  p.forEach((row, y) => {
    const full = row + row[1] + row[0]; // lật đối xứng thành 5 cột
    [...full].forEach((c, x) => {
      if (c === '1') {
        const fill = x === 2 ? t.accent : t.fg; // cột giữa dùng màu accent
        cells += `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${fill}"/>`;
      }
    });
  });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7" shape-rendering="crispEdges">` +
    `<rect width="7" height="7" fill="${t.bg}"/>${cells}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type AvatarItem = { id: string; name: string; src: string };

export const AVATARS: AvatarItem[] = PATTERNS.map((p, i) => ({
  id: `sqrt-${String(i + 1).padStart(2, '0')}`,
  name: `SQRT ${String(i + 1).padStart(2, '0')}`,
  src: toDataUri(p, THEMES[i % THEMES.length]),
}));

export const AVATAR_IDS = new Set(AVATARS.map((a) => a.id));
