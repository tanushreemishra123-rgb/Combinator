import { describe, expect, it } from 'vitest';
import { dataTopicLabel, targetTypeNoun } from './labels';

describe('dataTopicLabel', () => {
  it('gives every data-strategy topic a readable label', () => {
    expect(dataTopicLabel('privacy-security')).toBe('Privacy and security');
    expect(dataTopicLabel('backup-recovery')).toBe('Backup and recovery');
  });
});

describe('targetTypeNoun', () => {
  it('names every trace target type', () => {
    expect(targetTypeNoun('capability')).toBe('Capability');
    expect(targetTypeNoun('component')).toBe('Architecture component');
    expect(targetTypeNoun('workstream')).toBe('Estimate workstream');
    expect(targetTypeNoun('journey')).toBe('User journey');
  });
});
