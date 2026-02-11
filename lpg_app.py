"""
LPG Market Tracking – Arbitrage Calculation API
================================================

This module provides a minimal implementation of the LPG arbitrage calculation
specified in the design report. It exposes a REST API using FastAPI to compute
PG/FEI and PP/CP arbitrage opportunities for a list of monthly contracts.

It now also serves a lightweight front-end app from ``/`` so the project can be
used directly as a browser-based monitoring tool.
"""

from pathlib import Path
from typing import List

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


class PGData(BaseModel):
    """Data model for PG (LPG futures) arbitrage calculation."""

    month: str  # e.g. "Apr/2604"
    PG: float  # PG futures price in RMB/ton
    FEI: float  # FEI price in USD/ton
    CP: float  # CP price in USD/ton (not used in PG calculation but kept for consistency)
    FX: float  # FX rate: RMB per USD


class PPData(PGData):
    """Data model for PP (polypropylene) arbitrage calculation."""

    PP: float  # PP futures price in RMB/ton


def compute_pg_arbitrage(data: PGData) -> dict:
    """Compute PG/FEI difference and arbitrage in USD and RMB terms."""

    diff_usd = data.PG / data.FX - data.FEI
    cp_diff_usd = data.PG / data.FX - data.CP
    arb_cny = data.PG - data.FEI * data.FX * 1.11 * 1.09
    return {
        "month": data.month,
        "pg_fei_diff_usd": round(diff_usd, 2),
        "pg_cp_diff_usd": round(cp_diff_usd, 2),
        "pg_fei_arb": round(arb_cny, 2),
    }


def compute_pp_arbitrage(data: PPData, blpg1: float = 77.0, factor: float = 1500.0) -> dict:
    """Compute PP arbitrage relative to CP and FEI prices."""

    cp_cost = data.CP + blpg1
    pp_cp_diff = data.PP / data.FX - cp_cost
    pp_cp_arb = data.PP - cp_cost * data.FX * 1.01 * 1.09 * 1.18 - factor

    fei_cost = data.FEI
    pp_fei_diff = data.PP / data.FX - fei_cost
    pp_fei_arb = data.PP - fei_cost * data.FX * 1.11 * 1.09 * 1.18 - factor

    return {
        "month": data.month,
        "pp_cp_diff_usd": round(pp_cp_diff, 2),
        "pp_cp_arb": round(pp_cp_arb, 2),
        "pp_fei_diff_usd": round(pp_fei_diff, 2),
        "pp_fei_arb": round(pp_fei_arb, 2),
    }


app = FastAPI(
    title="LPG Arbitrage API",
    description=(
        "A simple API and front-end app for LPG (PG) and polypropylene (PP) "
        "arbitrage monitoring based on futures prices, FEI/CP benchmarks and exchange rates."
    ),
    version="0.2.0",
)


@app.post("/pg/arbitrage")
def pg_arbitrage(data: List[PGData]) -> List[dict]:
    """Compute PG arbitrage for a list of contract data."""

    return [compute_pg_arbitrage(item) for item in data]


@app.post("/pp/arbitrage")
def pp_arbitrage(data: List[PPData]) -> List[dict]:
    """Compute PP arbitrage for a list of contract data."""

    return [compute_pp_arbitrage(item) for item in data]


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def web_app() -> FileResponse:
    """Serve the front-end dashboard."""

    return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
