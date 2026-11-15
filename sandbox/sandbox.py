"""Python side of the mechanics sandbox, for mechanics.ipynb.

The math runs in Node (lib/engine.mjs), on the same code as the contracts and
the UI: backend/sdk/seedlib.mjs and frontend/src/lib/*.ts. This module only
calls it and turns the JSON into pandas tables and matplotlib charts.

    import sandbox as sb
    sb.parity()                       # frontend vs backend math
    sb.frontend_games(rounds=10_000)  # every game and choice, as a DataFrame
    r = sb.experiment(JS, keep=True)  # your own mechanic
    r.table, r.outcomes, r.mults
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
HOUSE_RETURN = 0.98


def _node(*args: str, stdin: str | None = None) -> object:
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js not found. Install Node 18+ and run `npm install` in sandbox/.")
    if not (HERE / "node_modules").exists():
        subprocess.run(["npm", "install", "--silent"], cwd=HERE, check=True)
    p = subprocess.run([node, "api.mjs", *args], cwd=HERE, input=stdin, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or f"api.mjs {args[0]} failed")
    return json.loads(p.stdout)


def parity(rounds: int = 500) -> pd.DataFrame:
    """Frontend math vs the backend toolkit. Every row should say match."""
    df = pd.DataFrame(_node("parity", "--rounds", str(rounds)))
    df["result"] = df["bad"].map(lambda b: "match" if b == 0 else f"{b} mismatches")
    return df[["name", "rounds", "result", "first"]]


def frontend_games(rounds: int = 10_000, beauty_rounds: int = 3_000, guesses: str | None = None) -> pd.DataFrame:
    """Every choice of every frontend game, played with the UI's resolveBet.

    guesses: Beauty Contest guesses to try, like "0-40" or "10,18,22".
    One row per (game, choice). `mean` is chips back per chip staked.
    """
    args = ["frontend", "--rounds", str(rounds), "--beauty-rounds", str(beauty_rounds)]
    if guesses:
        args += ["--guesses", guesses]
    data = _node(*args)
    rows = []
    for g in data["games"]:
        for r in g["rows"]:
            rows.append({"game_id": g["id"], "game": g["name"], "kind": g["kind"], "sim_only": g["simOnly"], **r})
    return pd.DataFrame(rows)


@dataclass
class Result:
    name: str
    rounds: int
    target: float | None
    table: pd.DataFrame
    outcomes: list = field(default_factory=list, repr=False)
    """What resolve() returned each round (only with keep=True and resolve/pays)."""
    mults: pd.DataFrame | None = field(default=None, repr=False)
    """Payout multiplier per round (rows) and choice (columns), with keep=True."""

    def __repr__(self) -> str:
        cols = ["label", "paidRate", "profitRate", "mean", "ci95", "max", "status"]
        return f"{self.name}: {self.rounds:,} rounds\n" + self.table[cols].to_string(index=False)

    def _repr_html_(self) -> str:
        cols = ["label", "paidRate", "profitRate", "mean", "ci95", "max", "status"]
        return f"<b>{self.name}</b>: {self.rounds:,} rounds<br>" + self.table[cols].to_html(index=False)


def experiment(js: str, rounds: int | None = None, keep: bool = False) -> Result:
    """Runs an experiment written in JavaScript, same format as SANDBOX.md.

    js: an object literal, { name, choices, play(seed, choice, t) } or
        { name, choices, resolve(seed, t), pays(outcome, choice) }.
    keep: also return every round's outcome and payout, for charts.
    """
    args = ["experiment"]
    if rounds:
        args += ["--rounds", str(rounds)]
    if keep:
        args.append("--keep")
    d = _node(*args, stdin=js)
    table = pd.DataFrame(d["rows"])
    mults = None
    if keep:
        mults = pd.DataFrame({row["label"]: col for row, col in zip(d["rows"], d["mults"])})
    return Result(d["name"], d["rounds"], d["target"], table, d.get("outcomes", []), mults)


# ---------------------------------------------------------------- charts


def plot_returns(df: pd.DataFrame, title: str = "", target: float | None = HOUSE_RETURN, ax=None):
    """Bar chart of return per choice with 95% intervals and the 0.98 line."""
    import matplotlib.pyplot as plt

    ax = ax or plt.subplots(figsize=(max(4, 0.6 * len(df) + 2), 3.2))[1]
    colors = ["#c0392b" if s not in (None, "ok") else "#3b6ea5" for s in df.get("status", [None] * len(df))]
    ax.bar(df["label"].astype(str), df["mean"], yerr=df["ci95"], color=colors, capsize=3)
    if target is not None:
        ax.axhline(target, color="#555", linestyle="--", linewidth=1, label=f"target {target}")
        ax.legend(loc="lower right", frameon=False)
    ax.set_ylabel("return per chip")
    ax.set_title(title)
    ax.spines[["top", "right"]].set_visible(False)
    return ax


def plot_convergence(mults: pd.DataFrame, target: float | None = HOUSE_RETURN, ax=None):
    """Running average return per choice as rounds go by. Shows how noisy short sessions are."""
    import matplotlib.pyplot as plt

    ax = ax or plt.subplots(figsize=(7, 3.2))[1]
    running = mults.expanding().mean()
    for col in running.columns:
        ax.plot(running.index + 1, running[col], linewidth=1, label=col)
    if target is not None:
        ax.axhline(target, color="#555", linestyle="--", linewidth=1)
    ax.set_xscale("log")
    ax.set_xlabel("rounds played")
    ax.set_ylabel("average return so far")
    ax.legend(frameon=False, fontsize=8)
    ax.spines[["top", "right"]].set_visible(False)
    return ax
