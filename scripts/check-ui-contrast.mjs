import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/app/globals.css", import.meta.url)), "utf8");
const token = name => {
  const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Missing solid color token: ${name}`);
  return rgb(value);
};
const rgb = hex => hex.replace("#", "").match(/../g).map(channel => parseInt(channel, 16));
const mix = (foreground, background, alpha) => foreground.map((value, i) => value * alpha + background[i] * (1 - alpha));
const luminance = color => color.map(value => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const ratio = (fg, bg) => {
  const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
const old = { bg: rgb("#0a0a10"), surface: rgb("#0d0d14"), raised: rgb("#12121b"), text: rgb("#f2f1ec"), muted: rgb("#9a9ab0"), primary: rgb("#e84142"), money: rgb("#22c55e") };
const current = { bg: token("bg"), surface: token("surface"), raised: token("surface-2"), text: token("text"), muted: token("muted"), primary: token("primary"), money: token("money") };
const rows = [];
for (const [name, key] of [["Chữ chính", "text"], ["Chữ phụ / nhãn", "muted"], ["Chữ đỏ", "primary"], ["Số liệu xanh", "money"]]) {
  for (const [surface, surfaceKey] of [["trang", "bg"], ["thẻ", "surface"], ["nổi", "raised"]]) rows.push([`${name} / nền ${surface}`, ratio(old[key], old[surfaceKey]), ratio(current[key], current[surfaceKey])]);
}
rows.push(["Placeholder / thẻ (opacity 60% → 100%)", ratio(mix(old.muted, old.surface, 0.6), old.surface), ratio(current.muted, current.surface)]);
rows.push(["Chữ trắng / nút đỏ", ratio(rgb("#ffffff"), old.primary), ratio(token("button-ink"), token("button-red"))]);
rows.push(["Chữ trắng / nút đỏ hover", ratio(rgb("#ffffff"), rgb("#ff5a5b")), ratio(token("button-ink"), token("button-red-hover"))]);
rows.push(["Nhãn mở / chip đỏ 10%", ratio(old.primary, mix(old.primary, old.surface, 0.1)), ratio(current.primary, mix(current.primary, current.surface, 0.1))]);
rows.push(["Nhãn / chip đỏ 20% trên nền nổi", ratio(old.primary, mix(old.primary, old.raised, 0.2)), ratio(current.text, mix(current.primary, current.raised, 0.2))]);
rows.push(["Nhãn đã chốt / chip xanh 10%", ratio(old.money, mix(old.money, old.surface, 0.1)), ratio(current.money, mix(current.money, current.surface, 0.1))]);
rows.push(["Chữ / nút viền đỏ hover 22%", ratio(old.text, mix(old.primary, old.bg, 0.22)), ratio(current.text, mix(current.primary, current.bg, 0.22))]);
console.log("| Cặp màu | Trước | Sau | AA ≥ 4.5 |\n|---|---:|---:|:---:|");
for (const [label, before, after] of rows) console.log(`| ${label} | ${before.toFixed(2)}:1 | ${after.toFixed(2)}:1 | ${after >= 4.5 ? "Đạt" : "FAIL"} |`);
if (rows.some(([, , after]) => after < 4.5)) process.exitCode = 1;
