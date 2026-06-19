window.AGENTS_LOG_DATA = [
  {
    "datetime": "2026-06-17T15:26:15Z",
    "phase": "1",
    "step": "1",
    "framework": "VoltAgent",
    "agent_name": "voltagent-lang:typescript-pro",
    "parallel": "y",
    "notes": "Stack proposals: TS library toolchain (tsup/vitest/biome)"
  },
  {
    "datetime": "2026-06-17T15:26:15Z",
    "phase": "1",
    "step": "1",
    "framework": "VoltAgent",
    "agent_name": "voltagent-core-dev:frontend-developer",
    "parallel": "y",
    "notes": "Stack proposals: React bindings API shape"
  },
  {
    "datetime": "2026-06-17T15:26:15Z",
    "phase": "1",
    "step": "2",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "n",
    "notes": "Task 001 scaffold review (0 blocking)"
  },
  {
    "datetime": "2026-06-17T15:26:15Z",
    "phase": "1",
    "step": "3",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "n",
    "notes": "Task 002 compression review (3 blocking fixed)"
  },
  {
    "datetime": "2026-06-17T15:30:34Z",
    "phase": "1",
    "step": "3",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:security-auditor",
    "parallel": "n",
    "notes": "Task 002 walker security audit: prototype-pollution fix confirmed sound; 1 Medium (deep-recursion DoS) fixed; Lows -> backlog"
  },
  {
    "datetime": "2026-06-18T14:48:46Z",
    "phase": "1",
    "step": "4",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "y",
    "notes": "Task 003 sanitization review: 2 blocking (deny-list false positives) fixed"
  },
  {
    "datetime": "2026-06-18T14:48:46Z",
    "phase": "1",
    "step": "4",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:security-auditor",
    "parallel": "y",
    "notes": "Task 003 sanitization audit: no Critical; 3 High (false-neg deny-list, Unicode evasion, Map-key tests) fixed"
  },
  {
    "datetime": "2026-06-18T15:04:22Z",
    "phase": "1",
    "step": "5",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "n",
    "notes": "Task 004 React hook review: 1 blocking (signature collision B1) fixed + regression test"
  },
  {
    "datetime": "2026-06-18T15:17:48Z",
    "phase": "1",
    "step": "6",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "n",
    "notes": "Task 005 docs review: APPROVE, 0 blocking; README verified against shipped API (no drift)"
  },
  {
    "datetime": "2026-06-18T16:15:24Z",
    "phase": "2",
    "step": "2",
    "framework": "Claude",
    "agent_name": "general-purpose",
    "parallel": "y",
    "notes": "Task 001 impl in worktree (packaging guards + sourcemap trim)"
  },
  {
    "datetime": "2026-06-18T16:15:24Z",
    "phase": "2",
    "step": "2",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "y",
    "notes": "Task 001 review: APPROVE, 0 blocking"
  },
  {
    "datetime": "2026-06-18T16:15:24Z",
    "phase": "2",
    "step": "4",
    "framework": "Claude",
    "agent_name": "general-purpose",
    "parallel": "y",
    "notes": "Task 003 impl in worktree (robustness hardening)"
  },
  {
    "datetime": "2026-06-18T16:15:24Z",
    "phase": "2",
    "step": "4",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "y",
    "notes": "Task 003 review: APPROVE, 0 blocking"
  },
  {
    "datetime": "2026-06-18T16:15:24Z",
    "phase": "2",
    "step": "4",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:security-auditor",
    "parallel": "y",
    "notes": "Task 003 audit: no Critical/High; no-leak preserved"
  },
  {
    "datetime": "2026-06-19T12:32:09Z",
    "phase": "2",
    "step": "3",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "n",
    "notes": "Task 002 review: APPROVE, 0 blocking"
  },
  {
    "datetime": "2026-06-19T12:32:09Z",
    "phase": "2",
    "step": "5",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:code-reviewer",
    "parallel": "y",
    "notes": "Task 004 review: 1 blocking (Error getter crash) fixed"
  },
  {
    "datetime": "2026-06-19T12:32:09Z",
    "phase": "2",
    "step": "5",
    "framework": "VoltAgent",
    "agent_name": "voltagent-qa-sec:security-auditor",
    "parallel": "y",
    "notes": "Task 004 audit: no Critical/High; sanitize-before-read intact; Error-message emission documented"
  }
];
