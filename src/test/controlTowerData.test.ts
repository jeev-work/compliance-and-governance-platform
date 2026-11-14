import { describe, expect, it } from 'vitest';
import { CONTROL_TOWER_AGENTS, dataQualityNames, randomPlatformHealth, SERVICE_PROCESSES, serviceAgentNames } from '@/lib/controlTowerData';
import { trustBandForScore } from '@/lib/trustScore';

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
    expect(CONTROL_TOWER_AGENTS.every(agent => agent.band === (agent.trustScore >= 95 ? 'GREEN' : agent.trustScore >= 90 ? 'AMBER' : 'RED'))).toBe(true);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'RED').length).toBeGreaterThan(0);
  });

  it('keeps exactly two agents in the RED action zone and ten in the AMBER watch zone', () => {
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'RED')).toHaveLength(2);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'AMBER')).toHaveLength(10);
    expect(CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'GREEN')).toHaveLength(155);
  });

  it('places four named Service Agents in the AMBER watch zone', () => {
    const amberServiceAgents = CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'service' && agent.band === 'AMBER');
    expect(amberServiceAgents.map(agent => agent.name)).toEqual([
      'Relationship selection',
      'General fulfilment',
      'Statement of Account',
      'Refund execution',
    ]);
    expect(amberServiceAgents.map(agent => agent.trustScore)).toEqual([94, 93, 92, 90]);
  });

  it('classifies trust scores at the requested inclusive boundaries', () => {
    expect(trustBandForScore(89)).toBe('RED');
    expect(trustBandForScore(90)).toBe('AMBER');
    expect(trustBandForScore(94)).toBe('AMBER');
    expect(trustBandForScore(95)).toBe('GREEN');
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