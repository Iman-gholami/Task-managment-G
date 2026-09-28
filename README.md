# Sentinel Ops: Task, Shift Log & Performance

Design package for the Security Department's internal work tool, covering three areas: Task Management, SOC Shift Logs, and Workforce Performance.

| File | Contents |
|---|---|
| `design/DESIGN_SYSTEM.md` | Principles, tokens (dark and light), typography, the indicator language, the component library, the table spec, interaction and accessibility rules |
| `design/SCREENS.md` | Specs for all 23 screens (purpose, user, hierarchy, layout, actions, components, and empty/loading/error states), with wireframes |
| `prototype/` | A clickable high-fidelity prototype. Open `prototype/index.html` in a browser; there is no build step |

Prototype tips: `⌘K` jumps between screens, `C` creates a task, `J/K/↵/S` work in task tables, ☀ toggles the theme, and **Switch role** in the sidebar cycles between the Analyst, SOC Manager, and Security Manager dashboards.

## Run locally

```bash
git clone https://github.com/iman-gholami/task-managment-g.git
cd task-managment-g/prototype
python3 -m http.server 8080      # or: npx serve -l 8080 .
```
Open `http://<server-ip>:8080`. The prototype is fully static and works offline: fonts are bundled and nothing is fetched from external services.
