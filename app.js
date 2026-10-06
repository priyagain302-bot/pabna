"use strict";
// Change the builder name shown on the splash screen here.
const APP_BUILDER = "LINKON";
const STORAGE_KEY = "pakizaOT.v1";
const DEFAULT_SETTINGS = { day: 3, night: 4, fri1: 6, fri2: 18, theme: "light" };
const $ = id => document.getElementById(id);

let state = load();
let editingId = null;

function load() {
  const fresh = { employee: { name: "", id: "" }, month: new Date().toISOString().slice(0, 7),
                  settings: { ...DEFAULT_SETTINGS }, records: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.records)) return { ...fresh, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
  } catch (e) { /* ignore corrupt data */ }
  return fresh;
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast("Could not save: device storage is full or blocked."); }
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.className = "show"; setTimeout(() => t.className = "", 2400); }

// Shift definitions are built from settings, so rules are never hard-coded.
function shiftOptions() {
  const s = state.settings;
  return [
    { key: "day", label: `Day — ${s.day} hours`, hours: s.day, group: "Day" },
    { key: "night", label: `Night — ${s.night} hours`, hours: s.night, group: "Night" },
    { key: "fri1", label: `Friday — ${s.fri1} hours`, hours: s.fri1, group: "Friday" },
    { key: "fri2", label: `Friday — ${s.fri2} hours`, hours: s.fri2, group: "Friday" },
    { key: "custom", label: "Custom", hours: null, group: "Custom" }
  ];
}
const groupOf = key => (shiftOptions().find(o => o.key === key) || { group: "Custom" }).group;
const shiftName = key => ({ day: "Day", night: "Night", fri1: "Friday", fri2: "Friday", custom: "Custom" }[key] || "Custom");
const fmt = n => String(Math.round(n * 100) / 100);
const monthRecords = () => state.records.filter(r => r.date.startsWith(state.month)).sort((a, b) => a.date.localeCompare(b.date));
const monthName = ym => { const [y, m] = ym.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }); };
const dateName = d => new Date(d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function renderShiftSelect() {
  const sel = $("recShift"), keep = sel.value || "day";
  sel.innerHTML = shiftOptions().map(o => `<option value="${o.key}">${o.label}</option>`).join("");
  sel.value = keep; onShiftChange();
}
function onShiftChange() {
  const opt = shiftOptions().find(o => o.key === $("recShift").value);
  if (opt.hours !== null) $("recHours").value = opt.hours;
  else if (editingId === null) $("recHours").value = "";
  $("recHours").readOnly = opt.hours !== null;
}
function renderSummary() {
  const recs = monthRecords(), g = { Day: [0, 0], Night: [0, 0], Friday: [0, 0], Custom: [0, 0] };
  let total = 0;
  recs.forEach(r => { const k = groupOf(r.shift); g[k][0] += r.hours; g[k][1]++; total += r.hours; });
  $("totalHours").textContent = fmt(total);
  const who = state.employee.name ? `${state.employee.name}${state.employee.id ? " (" + state.employee.id + ")" : ""} · ` : "";
  $("totalLabel").textContent = `${who}${monthName(state.month)}`;
  const icon = { Day: "☀️", Night: "🌙", Friday: "🌟", Custom: "✏️" };
  $("summaryTable").innerHTML = '<div class="tiles">' + Object.entries(g).map(([k, [h, c]]) =>
    `<div class="tile t-${k.toLowerCase()}"><span>${icon[k]} ${k} OT</span><b>${fmt(h)} h</b><small>${c} record${c === 1 ? "" : "s"}</small></div>`).join("") +
    `</div><div class="tile t-total"><span>Total OT</span><b>${fmt(total)} h</b><small>${recs.length} records</small></div>`;
}
function renderRecords() {
  const recs = monthRecords();
  $("recordList").innerHTML = recs.length ? recs.map(r => `<div class="rec c-${groupOf(r.shift).toLowerCase()}"><div><b>${dateName(r.date)}</b>
    <small>${shiftName(r.shift)} · ${fmt(r.hours)} hours</small></div>
    <div><button data-edit="${r.id}">Edit</button><button class="danger" data-del="${r.id}">Delete</button></div></div>`).join("")
    : `<p class="empty">No records for ${monthName(state.month)}. Add one on the Home tab.</p>`;
}
function renderDayGrid() {
  const [y, m] = state.month.split("-").map(Number), days = new Date(y, m, 0).getDate(), perDay = {}, kind = {};
  monthRecords().forEach(r => { const d = Number(r.date.slice(8)), gk = groupOf(r.shift).toLowerCase(); perDay[d] = (perDay[d] || 0) + r.hours; kind[d] = kind[d] && kind[d] !== gk ? "mixed" : gk; });
  let html = "";
  for (let d = 1; d <= days; d++) html += `<div class="day${perDay[d] ? " has g-" + kind[d] : ""}"><span>${d}</span><b>${perDay[d] ? fmt(perDay[d]) : "–"}</b></div>`;
  $("dayGrid").innerHTML = html + `<div class="legend"><i class="g-day"></i>Day <i class="g-night"></i>Night <i class="g-friday"></i>Friday <i class="g-custom"></i>Custom <i class="g-mixed"></i>Mixed</div><p class="empty">${days} days in ${monthName(state.month)}. Hours worked are shown under each day.</p>`;
}
function render() { renderSummary(); renderDayGrid(); renderRecords(); }

function resetForm() {
  editingId = null; $("formTitle").textContent = "Add OT record"; $("addBtn").textContent = "ADD OT RECORD";
  $("cancelEdit").hidden = true; $("recShift").value = "day"; onShiftChange();
}
function submitRecord() {
  const date = $("recDate").value, shift = $("recShift").value, hours = parseFloat($("recHours").value);
  if (!date) return toast("Choose a date.");
  if (!(hours > 0) || hours > 24 * 7) return toast("Enter OT hours greater than zero.");
  const dup = state.records.some(r => r.date === date && r.shift === shift && r.id !== editingId);
  if (dup && !confirm("A record with this date and shift already exists. Add anyway?")) return;
  if (editingId) Object.assign(state.records.find(r => r.id === editingId), { date, shift, hours });
  else state.records.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date, shift, hours });
  state.month = date.slice(0, 7); $("monthPicker").value = state.month;
  save(); resetForm(); render(); toast(editingId ? "Record updated." : "Record added.");
}
function startEdit(id) {
  const r = state.records.find(x => x.id === id); if (!r) return;
  editingId = id; $("recDate").value = r.date; $("recShift").value = r.shift; onShiftChange();
  $("recHours").value = r.hours; $("recHours").readOnly = false;
  $("formTitle").textContent = "Edit OT record"; $("addBtn").textContent = "SAVE CHANGES"; $("cancelEdit").hidden = false;
  showTab("home"); window.scrollTo(0, 0);
}
function showTab(name) {
  document.querySelectorAll("section[data-tab]").forEach(s => s.hidden = s.dataset.tab !== name);
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.go === name));
}
function applyTheme() { document.documentElement.dataset.theme = state.settings.theme; }
function fillSettings() {
  const s = state.settings;
  $("setDay").value = s.day; $("setNight").value = s.night; $("setFri1").value = s.fri1; $("setFri2").value = s.fri2; $("setTheme").value = s.theme;
}
function saveSettings() {
  const vals = ["setDay", "setNight", "setFri1", "setFri2"].map(i => parseFloat($(i).value));
  if (vals.some(v => !(v > 0))) return toast("Every rule needs hours greater than zero.");
  state.settings = { day: vals[0], night: vals[1], fri1: vals[2], fri2: vals[3], theme: $("setTheme").value };
  save(); applyTheme(); renderShiftSelect(); toast("Settings saved. Existing records keep their hours.");
}
function exportData() {
  const blob = new Blob([JSON.stringify({ app: "PakizaOT", version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `pakiza-ot-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result).data;
      const ok = d && Array.isArray(d.records) && d.records.every(r => r && r.id && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && typeof r.shift === "string" && r.hours > 0);
      if (!ok) throw new Error("bad");
      if (!confirm(`Replace all current data with ${d.records.length} records from this backup?`)) return;
      const fresh = load();
      state = { ...fresh, ...d, employee: { ...fresh.employee, ...d.employee }, settings: { ...DEFAULT_SETTINGS, ...d.settings } };
      if (!/^\d{4}-\d{2}$/.test(state.month)) state.month = fresh.month;
      save(); init(); toast("Backup restored.");
    } catch (e) { toast("Invalid backup file. Nothing was changed."); }
  };
  reader.readAsText(file);
}

function init() {
  applyTheme(); fillSettings(); renderShiftSelect();
  $("empName").value = state.employee.name; $("empId").value = state.employee.id;
  $("monthPicker").value = state.month; render();
}
document.addEventListener("DOMContentLoaded", () => {
  $("builder").textContent = APP_BUILDER;
  $("recDate").value = new Date().toISOString().slice(0, 10);
  init();
  $("recShift").onchange = onShiftChange;
  $("addBtn").onclick = submitRecord; $("cancelEdit").onclick = resetForm;
  $("monthPicker").onchange = e => { if (e.target.value) { state.month = e.target.value; save(); render(); } };
  $("saveEmp").onclick = () => {
    const name = $("empName").value.trim(); if (!name) return toast("Employee name cannot be blank.");
    state.employee = { name, id: $("empId").value.trim() }; save(); render(); toast("Employee saved.");
  };
  $("recordList").onclick = e => {
    if (e.target.dataset.edit) startEdit(e.target.dataset.edit);
    if (e.target.dataset.del && confirm("Delete this OT record?")) {
      state.records = state.records.filter(r => r.id !== e.target.dataset.del); save(); render();
    }
  };
  $("clearMonth").onclick = () => {
    if (!monthRecords().length) return toast("Nothing to delete this month.");
    if (confirm(`Delete all OT records for ${monthName(state.month)}?`)) {
      state.records = state.records.filter(r => !r.date.startsWith(state.month)); save(); render();
    }
  };
  $("saveSettings").onclick = saveSettings;
  $("resetSettings").onclick = () => { state.settings = { ...DEFAULT_SETTINGS }; save(); applyTheme(); fillSettings(); renderShiftSelect(); toast("Defaults restored."); };
  $("exportBtn").onclick = exportData;
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; };
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => showTab(b.dataset.go));
  setTimeout(() => $("splash").classList.add("hide"), 1400);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});
});
