import { detectHeading } from './headings';

describe('detectHeading', () => {
  it('returns null for a blank line', () => {
    expect(detectHeading('   ', 'next')).toBeNull();
  });

  it('matches a markdown heading up to level 6 and trims the title', () => {
    expect(detectHeading('###   Delivery constraints  ', undefined)).toEqual({ level: 3, title: 'Delivery constraints' });
  });

  it('rejects a lone hash with no title', () => {
    expect(detectHeading('#', undefined)).toBeNull();
  });

  it('matches a single-level numbered heading', () => {
    expect(detectHeading('1. Business goals', undefined)).toEqual({ level: 1, title: 'Business goals' });
  });

  it('matches a multi-level numbered heading and derives the level from the depth', () => {
    expect(detectHeading('2.3 Delivery constraints', undefined)).toEqual({ level: 2, title: 'Delivery constraints' });
  });

  it('rejects a numbered line that ends with terminal punctuation', () => {
    expect(detectHeading('1. This is a sentence, not a heading.', undefined)).toBeNull();
  });

  it('rejects a numbered heading candidate that is too long', () => {
    const longTitle = 'x'.repeat(90);
    expect(detectHeading(`1. ${longTitle}`, undefined)).toBeNull();
  });

  it('matches a short ALL-CAPS line', () => {
    expect(detectHeading('NON-FUNCTIONAL REQUIREMENTS', undefined)).toEqual({ level: 1, title: 'NON-FUNCTIONAL REQUIREMENTS' });
  });

  it('rejects an all-caps line that is really just punctuation or digits', () => {
    expect(detectHeading('----', undefined)).toBeNull();
    expect(detectHeading('12345', undefined)).toBeNull();
  });

  it('matches a colon heading only when followed by content', () => {
    expect(detectHeading('Assumptions:', 'We assume SSO is available.')).toEqual({ level: 2, title: 'Assumptions' });
    expect(detectHeading('Assumptions:', undefined)).toBeNull();
    expect(detectHeading('Assumptions:', '')).toBeNull();
  });

  it('prefers the markdown style over the numbered style when both could apply', () => {
    expect(detectHeading('# 1. Title', undefined)).toEqual({ level: 1, title: '1. Title' });
  });
});
