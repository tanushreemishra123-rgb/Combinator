/** Drag-and-drop (plus a button) upload zone, and the list of documents already added to the session. */
import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactElement } from 'react';
import type { UploadedDocumentInfo } from '../../../domain';
import { SUPPORTED_UPLOAD_EXTENSIONS } from '../../../ingestion';
import { Button, Callout, formatDateTime, formatNumber } from '../../common';
import { FileTextIcon, UploadIcon } from '../../common/icons';
import { validateUploadCandidate } from '../uploadValidation';

export interface FileUploadZoneProps {
  documents: readonly UploadedDocumentInfo[];
  uploading: boolean;
  onFiles: (files: File[]) => void;
}

function partitionFiles(files: File[]): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const reason = validateUploadCandidate(file);
    if (reason === null) {
      valid.push(file);
    } else {
      errors.push(reason);
    }
  }
  return { valid, errors };
}

export function FileUploadZone({ documents, uploading, onFiles }: FileUploadZoneProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  function acceptFiles(files: FileList | null): void {
    if (files === null || files.length === 0) {
      return;
    }
    const { valid, errors } = partitionFiles(Array.from(files));
    setLocalErrors(errors);
    if (valid.length > 0) {
      onFiles(valid);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragOver(false);
    acceptFiles(event.dataTransfer.files);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    acceptFiles(event.target.files);
    event.target.value = '';
  }

  return (
    <div className="stack stack-sm">
      <div
        className={`requirements-dropzone${isDragOver ? ' requirements-dropzone-active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <UploadIcon size={22} />
        <p>Drag and drop a requirements document here, or</p>
        <Button variant="secondary" size="sm" busy={uploading} onClick={() => inputRef.current?.click()}>
          Choose a file
        </Button>
        <p className="text-subtle text-xs">Supported formats: {SUPPORTED_UPLOAD_EXTENSIONS.join(', ')}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUPPORTED_UPLOAD_EXTENSIONS.join(',')}
          className="sr-only"
          aria-label="Upload a requirements document"
          onChange={handleInputChange}
        />
      </div>
      {localErrors.length > 0 ? (
        <Callout tone="danger" title="Some files were not uploaded">
          <ul className="stack stack-xs">
            {localErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {documents.length > 0 ? (
        <ul className="requirements-document-list">
          {documents.map((document) => (
            <li key={`${document.name}-${document.addedAt}`} className="requirements-document-item">
              <FileTextIcon size={16} />
              <span className="requirements-document-name">{document.name}</span>
              <span className="text-subtle text-xs">
                {formatNumber(document.characters)} characters - added {formatDateTime(document.addedAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">No documents uploaded yet - paste text below or upload one.</p>
      )}
    </div>
  );
}
