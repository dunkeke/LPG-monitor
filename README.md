# LPG 市场分析与跟盘 App

这个仓库现在包含两种形态：

1. **纯前端一键版（推荐用于 GitHub Pages）**
2. **FastAPI 接口版（用于前后端分离或服务端部署）**

---

## 1) 一键部署到 GitHub Pages（纯前端）

当前 `static/index.html + static/app.js + static/styles.css` 已可独立运行，
计算逻辑在浏览器内完成，不依赖后端接口。
并且支持两种行情录入：`JSON 数组` 与 `手动表格录入`（可切换）。

### 操作步骤

1. 在 GitHub 仓库中进入 **Settings → Pages**。
2. Source 选择 **Deploy from a branch**。
3. Branch 选择你的分支，目录选择 **/static**（如果界面可选文件夹）。
4. 保存后等待部署完成。

如果你的 Pages 只支持 `/docs`：
- 可把 `static` 内容复制到 `docs` 再部署。

---

## 2) 分别部署（前端 + 后端）

如果你需要后端 API（例如和其它系统对接，或后续加鉴权/数据库）：

- 前端：GitHub Pages
- 后端：Render / Railway / Fly.io / ECS 等

后端接口仍在 `lpg_app.py`：
- `POST /pg/arbitrage`
- `POST /pp/arbitrage`

---

## 3) Streamlit 可以吗？

可以。**Streamlit 不是 Pages 类型**，它是“可运行 Python 的应用托管/运行模式”。

- 如果你想快速做一个带表单、图表、上传的交互应用，Streamlit 很合适。
- 但它需要 Python 运行环境，不能像 GitHub Pages 那样只托管静态文件。

简化理解：
- **GitHub Pages** = 静态托管（HTML/CSS/JS）
- **Streamlit** = Python Web App 运行平台

---


## 4) 当前内外盘计算口径（与看板一致）

- **PG/FEI 价差 (USD/t)**：`PG / FX - FEI`
- **PG/CP 价差 (USD/t)**：`PG / FX - CP`
- **PG/FEI 套利 (¥/t)**：`PG - FEI * FX * 1.11 * 1.09`

- **PP/CP 价差 (USD/t)**：`PP / FX - (CP + BLPG1)`
- **PP/CP 套利 (¥/t)**：`PP - (CP + BLPG1) * FX * 1.01 * 1.09 * 1.18 - 1500`
- **PP/FEI 价差 (USD/t)**：`PP / FX - FEI`
- **PP/FEI 套利 (¥/t)**：`PP - FEI * FX * 1.11 * 1.09 * 1.18 - 1500`

其中默认 `BLPG1 = 77`。

盯盘信号会结合内外盘：
- PG：优先看 `PG/FEI ARB` 是否越过阈值，再用 `PG/FEI` 与 `PG/CP` 两个价差同向/分化做二次判断。
- PP：同时判断 `PP/CP ARB` 与 `PP/FEI ARB`，双边同向给出更强信号，分化时提示“内外盘分化”。

---
## 本地预览纯前端版

```bash
cd static
python -m http.server 4173
```

浏览器打开：
`http://localhost:4173`
