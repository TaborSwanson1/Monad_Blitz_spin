# Mechanics sandbox

Try game mechanics before anyone writes a contract or a screen, on the **same math** as the contracts and the UI.

| File | What it is |
|---|---|
| `SANDBOX.md` | The shared record. Write experiments in it as ```` ```js experiment ```` blocks, run `npm run sandbox`, and the results are written back under each block. Commit it. |
| `mechanics.ipynb` | The workbench: the same engine with charts (return per choice, the Crash curve against theory, the Beauty Contest guess sweep, session swings, Block Walk fair prices). |
| `sandbox.py` | Python helper the notebook imports: `parity()`, `frontend_games()`, `experiment(js)`, and two plot functions. |
| `api.mjs` | JSON interface to the engine (what `sandbox.py` calls). |
| `run.mjs` | Renders the engine's results into `SANDBOX.md`. |
| `lib/engine.mjs` | The simulations, stats and parity checks. |
| `lib/load.mjs` | Bundles the two read-only inputs with esbuild into `.cache/`. |

**Inputs, read only:**

- `frontend/src/lib/` (`games.ts`, `outcomes.ts`, `crash.ts`, `beauty.ts`): the UI's game models, run as they are.
- `backend/sdk/seedlib.mjs`: the backend seed toolkit, which `backend/test/SeedVectors.t.sol` keeps bit-for-bit equal to `SeedLib.sol`.

The sandbox never writes to `frontend/` or `backend/`.

## Setup

Needs Node 18+. For the notebook, any Python 3 kernel with pandas and matplotlib.

```bash
cd sandbox
npm install
npm run sandbox                  # runs SANDBOX.md (≈35 s at 10,000 rounds)
npm run sandbox -- --rounds 50000
```

Then open `mechanics.ipynb` in VS Code or Jupyter and run all cells (≈35 s).

## Writing an experiment

The format is the same in `SANDBOX.md` and the notebook. It's a JavaScript object literal:

```js
({
  name: 'Prize wheel',
  choices: ['spin'],
  resolve(seed, t) { return t.weighted(seed, 0, [55, 25, 15, 5]) },  // once per round
  pays(slice, choice) { return [0, 1.6, 2.4, 4.4][slice] },          // payout multiplier per choice
})
```

`t` holds the toolkit functions: `draw`, `uniform`, `chance`, `weighted`, `coin`, `crashX100`, `subSeed`, `unit`. `SANDBOX.md` has the full reference.

Results are reproducible, because round seeds are fixed as `keccak256("sandbox-<i>")`. A house game passes when its return is within noise of 0.98, a 2% edge.
