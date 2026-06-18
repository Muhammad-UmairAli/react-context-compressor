window.PLAN_DATA = {
  "0": {
    "label": "Phase 0",
    "steps": [
      {
        "num": "1",
        "name": "Verify environment",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "2",
        "name": "Copy SPLIT-PLAN.md template",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "3",
        "name": "Copy TIME-LOG.md + AGENT-LOG.md templates",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "4",
        "name": "Copy DASHBOARD.html stub",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "5",
        "name": "Copy TODO.md template",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "6",
        "name": "Copy CLAUDE.md template",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "7",
        "name": "Scaffold docs/ skeleton",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "8",
        "name": "Scaffold project-level quality configs",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "9",
        "name": "Scaffold .claude/ skeleton",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "10",
        "name": "Copy methodology/ docs",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "11",
        "name": "Copy integrations/ docs",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "12",
        "name": "Copy tools/ scripts",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "13",
        "name": "Make .claude/hooks/*.sh executable",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "14",
        "name": "Stage kit assets to .kit/ for slash commands",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "15",
        "name": "Append Phase 0 row to SPLIT-PLAN §5 (progress log)",
        "h_baseline": 0.0,
        "h_ai": 0.0
      },
      {
        "num": "16",
        "name": "Final integrity check",
        "h_baseline": 0.2,
        "h_ai": 0.2
      },
      {
        "num": "17",
        "name": "Integration Wizard - Project name",
        "h_baseline": 0.014,
        "h_ai": 0.014
      },
      {
        "num": "18",
        "name": "Integration Wizard - Branching model",
        "h_baseline": 0.008,
        "h_ai": 0.008
      },
      {
        "num": "19",
        "name": "Integration Wizard - Cloud provider",
        "h_baseline": 0.006,
        "h_ai": 0.006
      },
      {
        "num": "20",
        "name": "Integration Wizard - CCPM",
        "h_baseline": 0.011,
        "h_ai": 0.011
      },
      {
        "num": "21",
        "name": "Integration Wizard - AI plugins",
        "h_baseline": 0.02,
        "h_ai": 0.02
      },
      {
        "num": "22",
        "name": "Integration Wizard - Design identity",
        "h_baseline": 0.004,
        "h_ai": 0.004
      },
      {
        "num": "23",
        "name": "Integration Wizard - Branch protection",
        "h_baseline": 0.05,
        "h_ai": 0.05
      },
      {
        "num": "24",
        "name": "Integration Wizard - Pre-commit hooks",
        "h_baseline": 0.017,
        "h_ai": 0.017
      }
    ],
    "completed": "2026-06-17"
  },
  "1": {
    "label": "compress-state-for-llms",
    "steps": [
      {
        "num": "0",
        "name": "Phase 1 opened — SPLIT-PLAN §5 (progress log) + docs/phases/phase-001.md skeleton",
        "h_baseline": 0.05,
        "h_ai": 0.05
      },
      {
        "num": "1",
        "name": "Requirements, stack selection (VoltAgent), CCPM PRD→Epic→5 tasks, self-heal work-the-phase path",
        "h_baseline": 0.5,
        "h_ai": 0.5
      },
      {
        "num": "2",
        "name": "Task 001 scaffold: package.json (subpath exports, peer react, zero deps) + tsup/vitest/biome/changesets/size-limit + CI build job + typed stubs. PR #3 -> develop. Code review: 0 blocking.",
        "h_baseline": 3.0,
        "h_ai": 3.0
      },
      {
        "num": "3",
        "name": "Task 002 core compression walker: depth/strip/array-cap/dropEmpty/circular + Date/Map/Set/BigInt; code review (3 blocking fixed) + security audit (proto-pollution sound, DoS fixed); 30 tests, 100%/98.6% cov. PR #5 -> develop.",
        "h_baseline": 4.0,
        "h_ai": 4.0
      },
      {
        "num": "4",
        "name": "Task 003 sanitization: key-name deny-list (redact/remove), no-leak guarantee; code review (2 blocking) + security audit (3 High) fixed; 115 tests, 100%/98.96% cov. PR #7 -> develop.",
        "h_baseline": 3.0,
        "h_ai": 3.0
      },
      {
        "num": "5",
        "name": "Task 004 React hook: memoized useCompressedContext, collision-free options signature; code review (1 blocking) fixed; 127 tests, 100%/99.13%. PR #9 -> develop.",
        "h_baseline": 2.0,
        "h_ai": 2.0
      }
    ]
  }
};
