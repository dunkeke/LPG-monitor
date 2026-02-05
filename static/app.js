const inputEl = document.getElementById("inputData");
const statusEl = document.getElementById("status");
const pgBody = document.querySelector("#pgTable tbody");
const ppBody = document.querySelector("#ppTable tbody");

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
    return JSON.parse(inputEl.value);
  } catch {
    throw new Error("输入不是合法 JSON，请检查格式。");
  }
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

async function run(endpoint, tbody, columns) {
  try {
    setStatus("计算中...");
    const data = parseInput();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }

    const result = await response.json();
    renderRows(tbody, result, columns);
    setStatus(`计算完成，共 ${result.length} 条记录。`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.getElementById("calcPg").addEventListener("click", () =>
  run("/pg/arbitrage", pgBody, ["month", "pg_fei_diff_usd", "pg_fei_arb"])
);

document.getElementById("calcPp").addEventListener("click", () =>
  run("/pp/arbitrage", ppBody, ["month", "pp_cp_diff_usd", "pp_cp_arb", "pp_fei_diff_usd", "pp_fei_arb"])
);
