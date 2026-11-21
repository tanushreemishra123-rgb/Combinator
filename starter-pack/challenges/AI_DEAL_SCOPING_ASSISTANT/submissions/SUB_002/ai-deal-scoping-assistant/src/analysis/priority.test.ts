import { derivePriority } from './priority';
import { normalizeForMatch } from './textMatch';

const priorityOf = (text: string) => derivePriority(normalizeForMatch(text));

describe('derivePriority', () => {
  it('maps must / shall / critical / mandatory / required to High', () => {
    for (const text of ['Users must log in', 'The system shall log events', 'Critical for launch', 'MFA is mandatory', 'Audit trail is required']) {
      expect(priorityOf(text)).toBe('High');
    }
  });

  it('maps should / important to Medium', () => {
    expect(priorityOf('Managers should see dashboards')).toBe('Medium');
    expect(priorityOf('Reporting is important to us')).toBe('Medium');
  });

  it('maps could / nice to have / optional / future to Low', () => {
    for (const text of ['It could support dark mode', 'A chatbot is nice to have', 'Optional SMS alerts', 'Voice search in a future phase', 'We would like an AI assistant']) {
      expect(priorityOf(text)).toBe('Low');
    }
  });

  it('lets an explicit High cue win over a Low cue', () => {
    expect(priorityOf('The portal must support future growth')).toBe('High');
  });

  it('maps wording that defers or excludes an item to Low even when it says "required"', () => {
    expect(priorityOf('The solution should query the exchange later, but that integration is not required for go-live.')).toBe('Low');
    expect(priorityOf('It could extend to screening, though that is out of scope for this initial phase.')).toBe('Low');
    expect(priorityOf('Login is not required to browse public pages, but members must sign in to pay.')).toBe('High');
  });

  it('defaults to Medium when the wording carries no priority', () => {
    expect(priorityOf('Quarterly statements for members')).toBe('Medium');
  });
});
