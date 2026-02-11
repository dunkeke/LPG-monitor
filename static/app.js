const inputEl = document.getElementById("inputData");
const statusEl = document.getElementById("status");
const pgBody = document.querySelector("#pgTable tbody");
const ppBody = document.querySelector("#ppTable tbody");
const summaryEl = document.getElementById("summary");
const pgThresholdEl = document.getElementById("pgThreshold");
const ppThresholdEl = document.getElementById("ppThreshold");
const refreshSecondsEl = document.getElementById("refreshSeconds");
const toggleAutoBtn = document.getElementById("toggleAuto");
const inputModeEls = document.querySelectorAll("input[name=\"inputMode\"]");
const jsonInputPanel = document.getElementById("jsonInputPanel");
const manualInputPanel = document.getElementById("manualInputPanel");
const manualInputBody = document.querySelector("#manualInputTable tbody");
const addManualRowBtn = document.getElementById("addManualRow");

let autoTimer = null;

const DEFAULT_BLPG1 = 77.0;
const DEFAULT_FACTOR = 1500.0;

const sample = [
  { month: "Apr/2604", PG: 4515, FEI: 520, CP: 523, FX: 6.9236, PP: 7310 },
  { month: "May/2605", PG: 4422, FEI: 512, CP: 523, FX: 6.9236, PP: 7260 },
  { month: "Jun/2606", PG: 4384, FEI: 517, CP: 523, FX: 6.9236, PP: 7225 }
];
inputEl.value = JSON.stringify(sample, null, 2);
buildManualRows(sample);


function selectedInputMode() {
  return Array.from(inputModeEls).find((el) => el.checked)?.value || "json";
}

function switchInputMode(mode) {
  const useManual = mode === "manual";
  jsonInputPanel.classList.toggle("hidden", useManual);
  manualInputPanel.classList.toggle("hidden", !useManual);
}

function createManualRow(item = {}) {
  const tr = document.createElement("tr");
  const fields = ["month", "PG", "FEI", "CP", "FX", "PP"];

  for (const field of fields) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = field === "month" ? "text" : "number";
    if (input.type === "number") {
      input.step = "any";
    }
    input.value = item[field] ?? "";
    input.dataset.field = field;
    input.className = "manual-cell-input";
    td.appendChild(input);
    tr.appendChild(td);
  }

  manualInputBody.appendChild(tr);
}

function buildManualRows(items) {
  manualInputBody.innerHTML = "";
  items.forEach((item) => createManualRow(item));
}

function parseManualInput() {
  const rows = [];
  const trs = Array.from(manualInputBody.querySelectorAll("tr"));

  for (const tr of trs) {
    const row = {};
    let hasAnyValue = false;

    for (const input of tr.querySelectorAll("input")) {
      const { field } = input.dataset;
      const raw = input.value.trim();
      if (raw !== "") {
        hasAnyValue = true;
      }
      row[field] = field === "month" ? raw : Number(raw);
    }

    if (!hasAnyValue) {
      continue;
    }

    if (!row.month) {
      throw new Error("手动录入模式下，month 不能为空。");
    }

    for (const field of ["PG", "FEI", "CP", "FX", "PP"]) {
      if (!Number.isFinite(row[field])) {
        throw new Error(`手动录入模式下，${field} 需要填写数值。`);
      }
    }

    rows.push(row);
  }

  if (!rows.length) {
    throw new Error("手动录入模式下请至少填写一条完整行情。");
  }

  return rows;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#6b7280";
}

function parseInput() {
  if (selectedInputMode() === "manual") {
    return parseManualInput();
  }

  try {
    const parsed = JSON.parse(inputEl.value);
    if (!Array.isArray(parsed)) {
      throw new Error("输入必须是 JSON 数组。例：[ {...}, {...} ]");
    }
    return parsed;
  } catch (error) {
    throw new Error(error.message || "输入不是合法 JSON，请检查格式。");
  }
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function computePgArbitrage(item) {
  if (![item.month, item.PG, item.FEI, item.CP, item.FX].every((v) => v !== undefined)) {
    throw new Error("PG 计算缺少字段：month/PG/FEI/CP/FX");
  }

  const diffUsd = item.PG / item.FX - item.FEI;
  const cpDiffUsd = item.PG / item.FX - item.CP;
  const arbCny = item.PG - item.FEI * item.FX * 1.11 * 1.09;

  return {
    month: item.month,
    pg_fei_diff_usd: round2(diffUsd),
    pg_cp_diff_usd: round2(cpDiffUsd),
    pg_fei_arb: round2(arbCny)
  };
}

function computePpArbitrage(item, blpg1 = DEFAULT_BLPG1, factor = DEFAULT_FACTOR) {
  if (![item.month, item.PP, item.CP, item.FEI, item.FX].every((v) => v !== undefined)) {
    throw new Error("PP 计算缺少字段：month/PP/CP/FEI/FX");
  }

  const cpCost = item.CP + blpg1;
  const ppCpDiff = item.PP / item.FX - cpCost;
  const ppCpArb = item.PP - cpCost * item.FX * 1.01 * 1.09 * 1.18 - factor;

  const feiCost = item.FEI;
  const ppFeiDiff = item.PP / item.FX - feiCost;
  const ppFeiArb = item.PP - feiCost * item.FX * 1.11 * 1.09 * 1.18 - factor;

  return {
    month: item.month,
    pp_cp_diff_usd: round2(ppCpDiff),
    pp_cp_arb: round2(ppCpArb),
    pp_fei_diff_usd: round2(ppFeiDiff),
    pp_fei_arb: round2(ppFeiArb)
  };
}

function signalFromArb(value, threshold) {
  if (value >= threshold) {
    return { label: "套利机会", className: "signal signal-good" };
  }
  if (value <= -threshold) {
    return { label: "反套机会", className: "signal signal-warn" };
  }
  return { label: "观望", className: "signal signal-neutral" };
}

function signalFromPg(row, threshold) {
  const byArb = signalFromArb(row.pg_fei_arb, threshold);
  if (byArb.label === "观望") {
    return byArb;
  }

  if (row.pg_fei_diff_usd > 0 && row.pg_cp_diff_usd > 0 && byArb.label === "套利机会") {
    return { label: "内外盘同向正套", className: "signal signal-good" };
  }
  if (row.pg_fei_diff_usd < 0 && row.pg_cp_diff_usd < 0 && byArb.label === "反套机会") {
    return { label: "内外盘同向反套", className: "signal signal-warn" };
  }

  return { label: "内外盘分化", className: "signal signal-neutral" };
}

function signalFromPp(row, threshold) {
  const cpSignal = signalFromArb(row.pp_cp_arb, threshold).label;
  const feiSignal = signalFromArb(row.pp_fei_arb, threshold).label;

  if (cpSignal === "套利机会" && feiSignal === "套利机会") {
    return { label: "双边正套", className: "signal signal-good" };
  }
  if (cpSignal === "反套机会" && feiSignal === "反套机会") {
    return { label: "双边反套", className: "signal signal-warn" };
  }
  if (cpSignal !== "观望" || feiSignal !== "观望") {
    return { label: "内外盘分化", className: "signal signal-neutral" };
  }

  return { label: "观望", className: "signal signal-neutral" };
}

function renderRows(tbody, rows, columns) {
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const key of columns) {
      const td = document.createElement("td");
      if (key === "signal") {
        const span = document.createElement("span");
        span.className = row.signal.className;
        span.textContent = row.signal.label;
        td.appendChild(span);
      } else {
        td.textContent = row[key];
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function renderSummary(pgRows, ppRows) {
  summaryEl.innerHTML = "";
  const pgSignals = pgRows.filter((row) => row.signal.label !== "观望").length;
  const ppSignals = ppRows.filter((row) => row.signal.label !== "观望").length;
  const cards = [
    { title: "PG 机会", value: pgSignals, hint: "套利/反套合计" },
    { title: "PP 机会", value: ppSignals, hint: "套利/反套合计" },
    { title: "更新时间", value: new Date().toLocaleTimeString(), hint: "本地时间" }
  ];

  for (const card of cards) {
    const div = document.createElement("div");
    div.className = "summary-card";
    div.innerHTML = `<strong>${card.title}</strong><span>${card.value}</span><small>${card.hint}</small>`;
    summaryEl.appendChild(div);
  }
}

function runPg() {
  try {
    setStatus("监控刷新中...");
    const data = parseInput();
    const threshold = Number(pgThresholdEl.value) || 0;
    const result = data.map((item) => {
      const row = computePgArbitrage(item);
      return { ...row, signal: signalFromPg(row, threshold) };
    });
    renderRows(pgBody, result, ["month", "pg_fei_diff_usd", "pg_cp_diff_usd", "pg_fei_arb", "signal"]);
    renderSummary(result, []);
    setStatus(`PG 监控完成，共 ${result.length} 条记录。`);
    return result;
  } catch (error) {
    setStatus(error.message, true);
    return [];
  }
}

function runPp() {
  try {
    setStatus("监控刷新中...");
    const data = parseInput();
    const threshold = Number(ppThresholdEl.value) || 0;
    const result = data.map((item) => {
      const row = computePpArbitrage(item);
      const signal = signalFromPp(row, threshold);
      return { ...row, signal };
    });
    renderRows(ppBody, result, [
      "month",
      "pp_cp_diff_usd",
      "pp_cp_arb",
      "pp_fei_diff_usd",
      "pp_fei_arb",
      "signal"
    ]);
    renderSummary([], result);
    setStatus(`PP 监控完成，共 ${result.length} 条记录。`);
    return result;
  } catch (error) {
    setStatus(error.message, true);
    return [];
  }
}

function runAll() {
  const pgRows = runPg();
  const ppRows = runPp();
  renderSummary(pgRows, ppRows);
}

function startAuto() {
  const seconds = Number(refreshSecondsEl.value);
  if (!seconds || seconds <= 0) {
    setStatus("自动刷新已关闭。", true);
    return;
  }
  if (autoTimer) {
    clearInterval(autoTimer);
  }
  autoTimer = setInterval(runAll, seconds * 1000);
  toggleAutoBtn.textContent = "停止自动监控";
  toggleAutoBtn.classList.remove("secondary");
  setStatus(`已启用自动监控，每 ${seconds} 秒刷新一次。`);
}

function stopAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  toggleAutoBtn.textContent = "启用自动监控";
  toggleAutoBtn.classList.add("secondary");
  setStatus("自动监控已停止。", true);
}

function toggleAuto() {
  if (autoTimer) {
    stopAuto();
  } else {
    startAuto();
  }
}

document.getElementById("calcPg").addEventListener("click", runPg);
document.getElementById("calcPp").addEventListener("click", runPp);
document.getElementById("calcAll").addEventListener("click", runAll);
toggleAutoBtn.addEventListener("click", toggleAuto);
addManualRowBtn.addEventListener("click", () => createManualRow());
inputModeEls.forEach((el) => {
  el.addEventListener("change", () => switchInputMode(el.value));
});

switchInputMode(selectedInputMode());
runAll();
