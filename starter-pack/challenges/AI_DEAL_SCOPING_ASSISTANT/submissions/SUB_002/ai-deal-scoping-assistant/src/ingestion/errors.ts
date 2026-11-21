/** Typed failure raised by the ingestion layer; `message` is always safe to show to the user. */
export type IngestionErrorKind = 'unsupported-type' | 'oversize' | 'empty' | 'unreadable' | 'encrypted';

export class IngestionError extends Error {
  readonly kind: IngestionErrorKind;

  constructor(kind: IngestionErrorKind, message: string) {
    super(message);
    this.name = 'IngestionError';
    this.kind = kind;
  }
}
