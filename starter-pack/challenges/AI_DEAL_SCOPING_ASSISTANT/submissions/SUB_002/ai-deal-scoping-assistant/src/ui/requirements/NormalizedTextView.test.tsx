/**
 * Behaviour tests for the shared normalized-text renderer: the empty state, section headings with
 * line numbers (spec "Recommended Application Sections 1"), and the highlighted/quoted source
 * passage a source reference opens (spec Core User Journey step 5).
 */
import { render, screen } from '@testing-library/react';
import type { NormalizedDocument } from '../../domain';
import { fixtureDocument } from '../../test/fixtures';
import { NormalizedTextView } from './NormalizedTextView';

const EMPTY_DOCUMENT: NormalizedDocument = { text: '', lines: [], sections: [], wordCount: 0 };

describe('NormalizedTextView', () => {
  it('shows an empty state instead of a blank panel when there is nothing to preview', () => {
    render(<NormalizedTextView document={EMPTY_DOCUMENT} />);
    expect(screen.getByText('Nothing to preview yet')).toBeInTheDocument();
  });

  it('renders every line with its line number and each section heading once', () => {
    const document = fixtureDocument();
    render(<NormalizedTextView document={document} />);
    expect(screen.getByText('Business goals')).toBeInTheDocument();
    expect(screen.getByText('Functional needs')).toBeInTheDocument();
    for (const line of document.lines) {
      expect(screen.getByText(String(line.number))).toBeInTheDocument();
    }
  });

  it('highlights the requested line range and emphasises the quoted wording inside it', () => {
    const document = fixtureDocument();
    render(<NormalizedTextView document={document} highlightStart={3} highlightEnd={3} quote="call-centre volume" />);
    const mark = screen.getByText('call-centre volume', { selector: 'mark' });
    expect(mark).toBeInTheDocument();
    expect(mark.closest('.normalized-text-line-highlighted')).not.toBeNull();
  });

  it('does not mark anything when no highlight range is given', () => {
    const document = fixtureDocument();
    const { container } = render(<NormalizedTextView document={document} />);
    expect(container.querySelector('mark')).toBeNull();
  });
});
