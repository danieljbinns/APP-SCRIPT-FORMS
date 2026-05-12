# Repository Structure

## GAS Projects (folders)

| Folder | Environment | GAS Script |
|---|---|---|
| `employee_management_v2/` | **Production** | Live prod script |
| `employee_management_v2_staging/` | **Staging** | Staging script |
| `employee_management_v2_dev/` | **Dev** | Dev script |

Each folder has its own `.clasp.json` pointing to its respective GAS script ID.
Deployment is controlled by `clasp push` from within the folder — not by git branch.

## Branch Rules

| Branch | Contains |
|---|---|
| `staging` | All three project folders + root docs/tools |
| `dev` | All three project folders + root docs/tools |
| `main` | **`employee_management_v2/` only** (prod) |

When committing to `main`, only stage `employee_management_v2/` and root-level files.
Never stage `employee_management_v2_staging/` or `employee_management_v2_dev/` on `main`.

A pre-commit hook enforces this automatically.

## Root Folders

| Folder | Purpose |
|---|---|
| `docs/` | Documentation |
| `tools/` | Utility scripts |
| `project_summary/` | Project overview and exec docs |
| `_archive/` | Old files kept for reference |

## Root files that go to all branches
Anything in root not in `.gitignore` (docs, tools, etc.) is committed to all branches.
