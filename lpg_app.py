"""
LPG Market Tracking – Arbitrage Calculation API
================================================

This module provides a minimal implementation of the LPG arbitrage calculation
specified in the design report.  It exposes a REST API using FastAPI to
compute PG/FEI and PP/CP arbitrage opportunities for a list of monthly
contracts.  The formulas and factors are taken from the design report:

* **PG/FEI difference (USD/ton)** = (PG / FX) − FEI
* **PG/FEI arbitrage (RMB/ton)** = (PG − FEI × FX) × 1.11 × 1.09

For polypropylene (PP) arbitrage, two bases are used: CP (contract price) and
FEI (Far East Index):

* **PP/CP difference (USD/ton)** = (PP / FX) − (CP + BLPG1)
* **PP/CP arbitrage (RMB/ton)** = (PP − (CP + BLPG1) × FX) × 1.01 × 1.09 − FACTOR
* **PP/FEI difference (USD/ton)** = (PP / FX) − FEI
* **PP/FEI arbitrage (RMB/ton)** = (PP − FEI × FX) × 1.11 × 1.09 × 1.18 − FACTOR

where:

* ``PG`` and ``PP`` are domestic futures prices in RMB/ton.
* ``FEI`` and ``CP`` are international prices in USD/ton.
* ``FX`` is the RMB/USD exchange rate.
* ``BLPG1`` is the front-month LPG premium (default 77 USD/ton) representing
  freight and insurance costs when using CP as the basis.
* ``FACTOR`` is a fixed processing cost (default 1500 RMB/ton) applied in
  PP arbitrage formulas.

To run the API locally, install dependencies with ``pip install fastapi uvicorn pydantic`` and
start the server:

```
uvicorn lpg_app:app --reload
```

You can then POST JSON arrays of contract data to ``/pg/arbitrage`` or
``/pp/arbitrage`` to retrieve calculated arbitrage metrics.
"""

from typing import List
from fastapi import FastAPI
from pydantic import BaseModel


class PGData(BaseModel):
    """Data model for PG (LPG futures) arbitrage calculation."""
    month: str  # e.g. "Apr/2604"
    PG: float   # PG futures price in RMB/ton
    FEI: float  # FEI price in USD/ton
    CP: float   # CP price in USD/ton (not used in PG calculation but kept for consistency)
    FX: float   # FX rate: RMB per USD


class PPData(PGData):
    """Data model for PP (polypropylene) arbitrage calculation."""
    PP: float   # PP futures price in RMB/ton


def compute_pg_arbitrage(data: PGData) -> dict:
    """Compute PG/FEI difference and arbitrage in USD and RMB terms.

    Parameters
    ----------
    data : PGData
        Input data for a single contract month.

    Returns
    -------
    dict
        A dictionary containing the month, PG/FEI difference (USD/ton) and
        arbitrage value (RMB/ton).
    """
    # PG price converted to USD/ton for price difference
    diff_usd = data.PG / data.FX - data.FEI
    # FEI converted to RMB for arbitrage calculation
    fei_cny = data.FEI * data.FX
    # Arbitrage formula with import premiums (1.11 and 1.09 factors)
    arb_cny = (data.PG - fei_cny) * 1.11 * 1.09
    return {
        "month": data.month,
        "pg_fei_diff_usd": round(diff_usd, 2),
        "pg_fei_arb": round(arb_cny, 2),
    }


def compute_pp_arbitrage(data: PPData, blpg1: float = 77.0, factor: float = 1500.0) -> dict:
    """Compute PP arbitrage relative to CP and FEI prices.

    Parameters
    ----------
    data : PPData
        Input data for a single contract month.
    blpg1 : float, optional
        Premium over CP to account for freight and insurance, by default 77.
    factor : float, optional
        Fixed processing cost (RMB/ton) subtracted from arbitrage, by default 1500.

    Returns
    -------
    dict
        A dictionary containing computed price differences and arbitrage values.
    """
    # CP-based cost in USD
    cp_cost = data.CP + blpg1
    # PP/CP difference in USD/ton
    pp_cp_diff = data.PP / data.FX - cp_cost
    # PP/CP arbitrage (RMB/ton) with import premium factors
    pp_cp_arb = (data.PP - cp_cost * data.FX) * 1.01 * 1.09 - factor

    # FEI-based calculations
    fei_cost = data.FEI
    pp_fei_diff = data.PP / data.FX - fei_cost
    pp_fei_arb = (data.PP - fei_cost * data.FX) * 1.11 * 1.09 * 1.18 - factor

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
        "A simple API for computing LPG (PG) and polypropylene (PP) arbitrage "
        "metrics based on futures prices, FEI/CP benchmarks and exchange rates."
    ),
    version="0.1.0",
)


@app.post("/pg/arbitrage")
def pg_arbitrage(data: List[PGData]) -> List[dict]:
    """Compute PG arbitrage for a list of contract data.

    Returns a list of dictionaries with the computed metrics for each contract.
    """
    return [compute_pg_arbitrage(item) for item in data]


@app.post("/pp/arbitrage")
def pp_arbitrage(data: List[PPData]) -> List[dict]:
    """Compute PP arbitrage for a list of contract data.

    Returns a list of dictionaries with the computed metrics for each contract.
    """
    return [compute_pp_arbitrage(item) for item in data]


if __name__ == "__main__":  # pragma: no cover
    # Run the API locally with: python lpg_app.py
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
