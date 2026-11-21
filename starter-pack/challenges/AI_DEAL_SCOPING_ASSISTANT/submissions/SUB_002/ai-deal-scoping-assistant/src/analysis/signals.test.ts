import { SIGNAL_DEFINITIONS, isKnownSignal } from '../domain';
import { SIGNAL_KEYWORDS } from './signalKeywords.data';
import { detectSignals, hasSignal, rankSignalThemes } from './signals';

describe('signal keyword table', () => {
  it('covers every signal of the shared taxonomy exactly once', () => {
    const tableIds = SIGNAL_KEYWORDS.map((entry) => entry.signalId);
    expect([...tableIds].sort()).toEqual(SIGNAL_DEFINITIONS.map((signal) => signal.id).sort());
    expect(new Set(tableIds).size).toBe(tableIds.length);
  });

  it('only contains known ids and non-empty lower-case terms', () => {
    for (const entry of SIGNAL_KEYWORDS) {
      expect(isKnownSignal(entry.signalId)).toBe(true);
      expect(entry.terms.length).toBeGreaterThan(0);
      for (const term of entry.terms) {
        expect(term).toBe(term.toLowerCase());
        expect(term.trim()).not.toBe('');
      }
    }
  });
});

describe('detectSignals', () => {
  it('raises no AI signal for a statement that rules AI out, while keeping its other signals', () => {
    const signals = detectSignals('Generative AI must not be used for claim decisions; the self-service portal applies fixed business rules.');
    expect(signals.filter((signalId) => signalId.startsWith('ai:'))).toEqual([]);
    expect(signals).toContain('capability:portal');
    expect(detectSignals('The regulator prohibits the use of AI, including any chatbot.').some((signalId) => signalId.startsWith('ai:'))).toBe(false);
  });

  it('still raises AI signals when a wanted assistant is merely constrained', () => {
    expect(detectSignals('The assistant must not give clinical advice and has no aim beyond answering FAQs.')).toContain('ai:assistant');
  });

  it('tags an integration statement with the system and the exchange style', () => {
    const signals = detectSignals('The system must sync member profiles with our Salesforce CRM in near real-time.');
    expect(signals).toEqual(expect.arrayContaining(['integration:crm', 'integration:realtime']));
  });

  it('does not tag the generic system name "portal" as the self-service portal capability', () => {
    // Many customers call the whole system "the portal" - that alone must not imply a self-service portal ask.
    expect(detectSignals('The portal must be available 99.9% of the time.')).not.toContain('capability:portal');
    expect(detectSignals('Members can self-serve through our customer portal.')).toContain('capability:portal');
  });

  it('does not tag a Q&A/FAQ mention of billing or appointments as the payments or scheduling capability', () => {
    const signals = detectSignals('Patients get self-service answers about appointment preparation and billing questions.');
    expect(signals).not.toContain('capability:payments');
    expect(signals).not.toContain('capability:scheduling');
  });

  it('does not tag a cadence phrase like "on a schedule" or a "published event stream" mention as a product capability', () => {
    expect(detectSignals('Receive files from the carrier on a schedule agreed in advance.')).not.toContain('capability:scheduling');
    expect(detectSignals('Event-driven integration via the vendor\'s published event stream.')).not.toContain('capability:content');
    expect(detectSignals('Let users book an appointment with a case worker.')).toContain('capability:scheduling');
  });

  it('does not tag a data-classification requirement as an AI classification use case', () => {
    const signals = detectSignals('Customer data is personally identifiable information and must be classified and handled accordingly.');
    expect(signals).not.toContain('ai:classification');
    expect(signals).toContain('data:pii');
    expect(detectSignals('Route each inbound ticket using an automatic classification model.')).toContain('ai:classification');
  });

  it('tags a decision-support suggestion drawn from similar historical cases as an AI recommendation', () => {
    const signals = detectSignals('The portal could offer examiners a suggested reserve range based on similar historical claims, clearly marked as advisory only.');
    expect(signals).toContain('ai:recommendation');
  });

  it('tags AI, security and compliance wording', () => {
    expect(detectSignals('An AI assistant answers questions from our document library')).toEqual(expect.arrayContaining(['ai:assistant', 'ai:rag']));
    expect(detectSignals('Data is encrypted at rest; SSO via Okta; GDPR applies')).toEqual(
      expect.arrayContaining(['security:encryption', 'security:sso', 'compliance:gdpr', 'integration:identity-provider']),
    );
  });

  it('tags cloud preference, NFRs and delivery constraints', () => {
    expect(detectSignals('We prefer Microsoft Azure')).toContain('cloud:azure');
    expect(detectSignals('99.9% uptime with 2,000 concurrent users')).toEqual(expect.arrayContaining(['nfr:availability', 'nfr:scalability']));
    expect(detectSignals('Go-live deadline with a fixed budget')).toEqual(expect.arrayContaining(['delivery:deadline', 'delivery:budget']));
  });

  it('does not fire short keywords inside longer words', () => {
    expect(detectSignals('Our aim is to maintain paid services')).not.toContain('ai:assistant');
    expect(detectSignals('Encrypted at rest')).not.toContain('integration:api');
    expect(detectSignals('Plant a sapling')).not.toContain('integration:erp');
  });

  it('returns only known signals, without duplicates, in a stable order', () => {
    const text = 'Dashboard reports, dashboards and more reports for the CRM';
    const signals = detectSignals(text);
    expect(new Set(signals).size).toBe(signals.length);
    expect(signals.every(isKnownSignal)).toBe(true);
    expect(detectSignals(text)).toEqual(signals);
  });

  it('returns an empty list for empty, whitespace or non-Latin text', () => {
    expect(detectSignals('')).toEqual([]);
    expect(detectSignals('   \n ')).toEqual([]);
    expect(detectSignals('システムは使いやすくなければなりません')).toEqual([]);
  });

  it('hasSignal checks membership', () => {
    expect(hasSignal(['ai:rag'], 'ai:rag')).toBe(true);
    expect(hasSignal(['ai:rag'], 'ai:vision')).toBe(false);
  });
});

describe('rankSignalThemes', () => {
  it('orders labels by frequency and breaks ties by taxonomy order', () => {
    const themes = rankSignalThemes([['integration:crm', 'ai:rag'], ['ai:rag'], ['capability:search']], 2);
    expect(themes).toEqual(['Retrieval-augmented question answering', 'Search and discovery']);
  });

  it('returns an empty list when nothing was detected', () => {
    expect(rankSignalThemes([[], []], 3)).toEqual([]);
  });
});
