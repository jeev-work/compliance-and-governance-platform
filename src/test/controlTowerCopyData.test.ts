import { describe, expect, it } from 'vitest';
import { CONTROL_TOWER_AGENTS, SERVICE_PROCESSES } from '@/lib/controlTowerData';
import { CONTROL_TOWER_AGENTS as COPY_AGENTS, SERVICE_PROCESSES as COPY_PROCESSES } from '@/lib/controlTowerCopyData';

describe('Screen 12 independent catalogue', () => {
  it('starts with the same 167 agents and ten processes as Screen 11', () => {
    expect(COPY_AGENTS).toHaveLength(167);
    expect(COPY_AGENTS).toEqual(CONTROL_TOWER_AGENTS);
    expect(COPY_PROCESSES).toHaveLength(10);
    expect(COPY_PROCESSES).toEqual(SERVICE_PROCESSES);
  });

  it('does not share mutable agents or processes with Screen 11', () => {
    const originalScore = CONTROL_TOWER_AGENTS[0].trustScore;
    const originalHealth = SERVICE_PROCESSES[0].health;
    const copyScore = COPY_AGENTS[0].trustScore;
    const copyHealth = COPY_PROCESSES[0].health;
    try {
      COPY_AGENTS[0].trustScore = 1;
      COPY_PROCESSES[0].health = 1;
      expect(CONTROL_TOWER_AGENTS[0].trustScore).toBe(originalScore);
      expect(SERVICE_PROCESSES[0].health).toBe(originalHealth);
    } finally {
      COPY_AGENTS[0].trustScore = copyScore;
      COPY_PROCESSES[0].health = copyHealth;
    }
  });
});