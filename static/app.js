const inputEl = document.getElementById("inputData");
const statusEl = document.getElementById("status");
const pgBody = document.querySelector("#pgTable tbody");
const ppBody = document.querySelector("#ppTable tbody");

const DEFAULT_BLPG1 = 77.0;
const DEFAULT_FACTOR = 1500.0;

const sample = [
  { month: "Apr/2604", PG: 4515, FEI: 520, CP: 523, FX: 6.9236, PP: 7310 },
  { month: "May/2605", PG: 4422, FEI: 512, CP: 523, FX: 6.9236, PP: 7260 },
  { month: "Jun/2606", PG: 4384, FEI: 517, CP: 523, FX: 6.9236, PP: 7225 }
];
inputEl.value = JSON.stringify(sample, null, 2);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#6b7280";
}

function parseInput() {
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
  if (![item.month, item.PG, item.FEI, item.FX].every((v) => v !== undefined)) {
    throw new Error("PG 计算缺少字段：month/PG/FEI/FX");
  }

  const diffUsd = item.PG / item.FX - item.FEI;
  const feiCny = item.FEI * item.FX;
  const arbCny = (item.PG - feiCny) * 1.11 * 1.09;

  return {
    month: item.month,
    pg_fei_diff_usd: round2(diffUsd),
    pg_fei_arb: round2(arbCny)
  };
}

function computePpArbitrage(item, blpg1 = DEFAULT_BLPG1, factor = DEFAULT_FACTOR) {
  if (![item.month, item.PP, item.CP, item.FEI, item.FX].every((v) => v !== undefined)) {
    throw new Error("PP 计算缺少字段：month/PP/CP/FEI/FX");
  }

  const cpCost = item.CP + blpg1;
  const ppCpDiff = item.PP / item.FX - cpCost;
  const ppCpArb = (item.PP - cpCost * item.FX) * 1.01 * 1.09 - factor;

  const feiCost = item.FEI;
  const ppFeiDiff = item.PP / item.FX - feiCost;
  const ppFeiArb = (item.PP - feiCost * item.FX) * 1.11 * 1.09 * 1.18 - factor;

  return {
    month: item.month,
    pp_cp_diff_usd: round2(ppCpDiff),
    pp_cp_arb: round2(ppCpArb),
    pp_fei_diff_usd: round2(ppFeiDiff),
    pp_fei_arb: round2(ppFeiArb)
  };
}

function renderRows(tbody, rows, columns) {
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const key of columns) {
      const td = document.createElement("td");
      td.textContent = row[key];
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function runPg() {
  try {
    setStatus("本地计算中...");
    const data = parseInput();
    const result = data.map(computePgArbitrage);
    renderRows(pgBody, result, ["month", "pg_fei_diff_usd", "pg_fei_arb"]);
    setStatus(`PG 计算完成，共 ${result.length} 条记录。`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function runPp() {
  try {
    setStatus("本地计算中...");
    const data = parseInput();
    const result = data.map((item) => computePpArbitrage(item));
    renderRows(ppBody, result, ["month", "pp_cp_diff_usd", "pp_cp_arb", "pp_fei_diff_usd", "pp_fei_arb"]);
    setStatus(`PP 计算完成，共 ${result.length} 条记录。`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.getElementById("calcPg").addEventListener("click", runPg);
document.getElementById("calcPp").addEventListener("click", runPp);
