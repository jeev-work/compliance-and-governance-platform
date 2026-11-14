import { describe, expect, it } from 'vitest';
import { CONTROL_TOWER_AGENTS, dataQualityNames, randomPlatformHealth, SERVICE_PROCESSES, serviceAgentNames } from '@/lib/controlTowerData';

describe('control tower demo catalogue', () => {
  it('contains 20 compliance, 19 platform, and 16 data quality records from the supplied lists', () => {
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'service')).toHaveLength(112);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'service').map(agent => agent.name)).toEqual(serviceAgentNames);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'compliance')).toHaveLength(20);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'platform')).toHaveLength(19);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'data-quality')).toHaveLength(16);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'data-quality').map(agent => agent.name)).toEqual(dataQualityNames);
  });

  it('keeps each illustrative trust score within the displayed 0–100 scale', () => {
    expect(CONTROL_TOWER_AGENTS.every(agent => agent.trustScore >= 0 && agent.trustScore <= 100)).toBe(true);
    expect(CONTROL_TOWER_AGENTS.every(agent => agent.band === (agent.trustScore >= 80 ? 'GREEN' : agent.trustScore >= 60 ? 'AMBER' : 'RED'))).toBe(true);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'RED').length).toBeGreaterThan(0);
  });

  it('keeps exactly two agents in the RED action zone and six in the AMBER watch zone', () => {
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'RED')).toHaveLength(2);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'AMBER')).toHaveLength(6);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'GREEN')).toHaveLength(159);
  });

  it('randomizes platform process health within the requested 85–99 range', () => {
    expect(randomPlatformHealth(() => 0)).toBe(85);
    expect(randomPlatformHealth(() => 0.99999)).toBe(99);
  });

  it('provides the ten requested service processes with a statement-of-account incident', () => {
    expect(SERVICE_PROCESSES).toHaveLength(10);
    expect(SERVICE_PROCESSES[1]).toMatchObject({ name: 'Statement of account', health: 72 });
  });
});