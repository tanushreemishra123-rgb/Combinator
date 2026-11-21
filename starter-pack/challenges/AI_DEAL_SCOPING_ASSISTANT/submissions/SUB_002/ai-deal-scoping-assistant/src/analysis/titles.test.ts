import { MAX_TITLE_WORDS, asSentence, buildTitle } from './titles';

describe('buildTitle', () => {
  it('drops the lead-in and capitalises what is being asked for', () => {
    expect(buildTitle('Members must be able to register, sign in with SSO and update their profile.')).toBe(
      'Register, sign in with SSO and update their profile',
    );
    expect(buildTitle('We would like an AI assistant.')).toBe('An AI assistant');
  });

  it('rephrases passive requirements around their subject', () => {
    expect(buildTitle('All personal data must be encrypted at rest and in transit and comply with GDPR.')).toBe(
      'Personal data encrypted at rest and in transit',
    );
  });

  it('cuts long titles at a clause boundary and never ends on a stop word', () => {
    const title = buildTitle('The portal must be available 99.9% of the time and support 50,000 registered members.');
    expect(title).toBe('Portal available 99.9% of the time');
    expect(buildTitle('The system should send the monthly statements to all of the registered members in the region')).toBe(
      'Send the monthly statements to all of the registered',
    );
  });

  it('never exceeds the word limit', () => {
    const title = buildTitle('word '.repeat(40));
    expect(title.split(' ').length).toBeLessThanOrEqual(MAX_TITLE_WORDS);
  });

  it('keeps statements without a lead-in, including non-Latin text', () => {
    expect(buildTitle('quarterly statements for members')).toBe('Quarterly statements for members');
    expect(buildTitle('系统必须支持单点登录。')).toBe('系统必须支持单点登录');
  });
});

describe('asSentence', () => {
  it('capitalises and terminates a statement once', () => {
    expect(asSentence('our team prefers Azure')).toBe('Our team prefers Azure.');
    expect(asSentence('Is offline needed?')).toBe('Is offline needed?');
    expect(asSentence('  ')).toBe('');
  });
});
