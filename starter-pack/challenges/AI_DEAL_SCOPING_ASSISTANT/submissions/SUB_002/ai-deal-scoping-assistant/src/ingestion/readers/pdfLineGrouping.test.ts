import { groupTextItemsIntoLines, type PositionedTextItem } from './pdfLineGrouping';

describe('groupTextItemsIntoLines', () => {
  it('returns an empty array for no items', () => {
    expect(groupTextItemsIntoLines([])).toEqual([]);
  });

  it('joins items on the same y band, left to right, into one line', () => {
    const items: PositionedTextItem[] = [
      { text: 'World', x: 60, y: 700 },
      { text: 'Hello ', x: 0, y: 700 },
    ];
    expect(groupTextItemsIntoLines(items)).toEqual(['Hello World']);
  });

  it('orders lines top to bottom by decreasing y (PDF space)', () => {
    const items: PositionedTextItem[] = [
      { text: 'Second line', x: 0, y: 680 },
      { text: 'First line', x: 0, y: 700 },
      { text: 'Third line', x: 0, y: 660 },
    ];
    expect(groupTextItemsIntoLines(items)).toEqual(['First line', 'Second line', 'Third line']);
  });

  it('treats items within the y tolerance as the same line even out of exact alignment', () => {
    const items: PositionedTextItem[] = [
      { text: 'Sub', x: 0, y: 700 },
      { text: 'script', x: 20, y: 701.5 },
    ];
    expect(groupTextItemsIntoLines(items)).toEqual(['Subscript']);
  });

  it('treats items beyond the y tolerance as separate lines', () => {
    const items: PositionedTextItem[] = [
      { text: 'Line A', x: 0, y: 700 },
      { text: 'Line B', x: 0, y: 690 },
    ];
    expect(groupTextItemsIntoLines(items)).toEqual(['Line A', 'Line B']);
  });

  it('trims trailing whitespace from a reconstructed line', () => {
    const items: PositionedTextItem[] = [{ text: 'Trailing space  ', x: 0, y: 700 }];
    expect(groupTextItemsIntoLines(items)).toEqual(['Trailing space']);
  });
});
