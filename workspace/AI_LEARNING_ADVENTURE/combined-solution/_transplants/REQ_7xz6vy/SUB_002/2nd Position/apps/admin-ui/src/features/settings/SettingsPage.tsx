import { useEffect, useRef, useState } from 'react';
import type {
  AdminContentBundle,
  AdminImportReport,
  AdminSeedStatusDto,
} from '@ai-learning-adventure/types';
import { Button, RadioGroup, Table, TableBody, TableCell, TableContainer, TableHead, TableHeaderCell, TableRow, Typography } from '@/components/ui';
import { AdminShell } from '@/components/layout/AdminShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminApiError, adminApi } from '@/lib/api';
import { useRevalidateAll } from '@/lib/hooks';
import styles from './SettingsPage.module.scss';

const SCHEMA_ROWS: Array<{ entity: string; fields: string; notes: string }> = [
  {
    entity: 'Mission',
    fields: 'title, slug, difficulty, level track, order, objective, lesson blocks, example/scenario, checkpoint, estimated minutes, pass threshold, prerequisite',
    notes: 'Required: title, slug (unique, lowercase/hyphens), objective, lesson, example, checkpoint, positive minutes, pass threshold 1–100.',
  },
  {
    entity: 'Question',
    fields: 'mission, type, stem, scenario (scenario type), options, correct marking, correct/incorrect explanations, concept tags, difficulty, reasoning toggle',
    notes: 'True/false requires exactly True and False options. Single-answer needs exactly one correct option. At least two options.',
  },
  {
    entity: 'Flashcard',
    fields: 'mission, concept, definition, example, common mistake, learning tip, concept tags, difficulty',
    notes: 'Concept, definition, and example are required. At least one of common mistake or learning tip is required.',
  },
  {
    entity: 'Badge / Milestone',
    fields: 'kind, name, icon, description, linked mission (badge), rule (milestone)',
    notes: 'Badges must link to a mission. Milestones use a declarative rule with a threshold.',
  },
];

export function SettingsPage() {
  const revalidateAll = useRevalidateAll();
  const [seed, setSeed] = useState<AdminSeedStatusDto | undefined>(undefined);
  const [seedError, setSeedError] = useState<string | undefined>(undefined);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importReport, setImportReport] = useState<AdminImportReport | undefined>(undefined);
  const [importBundle, setImportBundle] = useState<AdminContentBundle | undefined>(undefined);
  const [importError, setImportError] = useState<string | undefined>(undefined);
  const [importMode, setImportMode] = useState('merge');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminApi
      .seedStatus()
      .then(setSeed)
      .catch((error: unknown) => setSeedError(error instanceof Error ? error.message : 'Failed to load seed status.'));
  }, []);

  async function handleReloadSeed() {
    setBusy(true);
    try {
      const next = await adminApi.reloadSeed();
      setSeed(next);
      setReloadOpen(false);
      await revalidateAll();
    } catch (error) {
      setSeedError(error instanceof AdminApiError ? error.message : 'Seed reload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const bundle = await adminApi.exportBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'ai-quest-content-bundle.json';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportError(error instanceof AdminApiError ? error.message : 'Export failed.');
    }
  }

  function handleFilePicked(file: File | undefined) {
    setImportReport(undefined);
    setImportBundle(undefined);
    setImportError(undefined);
    if (file === undefined) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AdminContentBundle;
        setImportBundle(parsed);
        void runDryRun(parsed);
      } catch {
        setImportError('The file is not valid JSON.');
      }
    };
    reader.onerror = () => setImportError('The file could not be read.');
    reader.readAsText(file);
  }

  async function runDryRun(bundle: AdminContentBundle) {
    setImportError(undefined);
    try {
      const report = await adminApi.importBundle(bundle, importMode === 'replace' ? 'replace' : 'merge', true);
      setImportReport(report);
    } catch (error) {
      setImportError(error instanceof AdminApiError ? error.message : 'Dry run failed.');
    }
  }

  async function handleApplyImport() {
    if (importBundle === undefined) return;
    setBusy(true);
    try {
      const report = await adminApi.importBundle(importBundle, importMode === 'replace' ? 'replace' : 'merge', false);
      setImportReport(report);
      setImportBundle(undefined);
      await revalidateAll();
      setSeed(await adminApi.seedStatus().catch(() => undefined));
    } catch (error) {
      setImportError(error instanceof AdminApiError ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Settings" description="Schema reference, seed integrity, and content import/export.">
      <section className={styles.card}>
        <Typography variant="card-title" as="h2">
          Schema reference
        </Typography>
        <TableContainer>
          <Table minWidth={640}>
            <TableHead>
              <TableRow hoverable={false}>
                <TableHeaderCell>Entity</TableHeaderCell>
                <TableHeaderCell>Fields</TableHeaderCell>
                <TableHeaderCell>Validation rules</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {SCHEMA_ROWS.map((row) => (
                <TableRow key={row.entity}>
                  <TableCell>{row.entity}</TableCell>
                  <TableCell>{row.fields}</TableCell>
                  <TableCell>{row.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </section>

      <section className={styles.card}>
        <Typography variant="card-title" as="h2">
          Seed content
        </Typography>
        {seedError !== undefined && (
          <p role="alert" style={{ color: '#B91C1C' }}>
            {seedError}
          </p>
        )}
        {seed === undefined && seedError === undefined && <Typography variant="body-muted">Loading…</Typography>}
        {seed !== undefined && (
          <>
            <p className={styles.counts}>
              {seed.counts.missions} missions · {seed.counts.questions} questions · {seed.counts.flashcards} flashcards ·{' '}
              {seed.counts.awards} awards
            </p>
            <ul className={styles.integrityList}>
              {seed.integrity.map((row) => (
                <li key={row.missionId}>
                  <strong>{row.title || row.missionId}</strong>
                  {row.checks.map((check) => (
                    <span key={check.rule} className={check.ok ? styles.checkOk : styles.checkFail}>
                      {check.ok ? '✓' : '✗'} {check.rule} — {check.detail}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <Button variant="outline" onClick={() => setReloadOpen(true)} disabled={busy}>
              Reload seed pack
            </Button>
          </>
        )}
      </section>

      <section className={styles.card}>
        <Typography variant="card-title" as="h2">
          Content data
        </Typography>
        <p className={styles.hint}>
          Export downloads a JSON bundle for committing as seed data. Imports arrive as drafts so the publish gate
          always applies. A dry run previews what an import would change.
        </p>
        <div className={styles.actions}>
          <Button variant="outline" onClick={() => void handleExport()}>
            Export bundle
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            Import bundle…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className={styles.fileInput}
            onChange={(event) => handleFilePicked(event.target.files?.[0])}
          />
        </div>
        {importBundle !== undefined && (
          <div className={styles.importPanel}>
            <RadioGroup
              name="import-mode"
              label="Import mode"
              value={importMode}
              onChange={setImportMode}
              options={[
                { label: 'Merge', value: 'merge', description: 'Upsert by id; matching ids are updated.' },
                { label: 'Replace', value: 'replace', description: 'Archive current content and import the bundle.' },
              ]}
            />
            <Button variant="primary" onClick={() => void handleApplyImport()} disabled={busy || importReport?.dryRun !== true}>
              {busy ? 'Working…' : 'Apply import'}
            </Button>
          </div>
        )}
        {importError !== undefined && (
          <p role="alert" style={{ color: '#B91C1C' }}>
            {importError}
          </p>
        )}
        {importReport !== undefined && (
          <div className={styles.importReport}>
            <Typography variant="card-title" as="h3">
              {importReport.dryRun ? 'Dry run' : 'Import result'}
            </Typography>
            <TableContainer>
              <Table minWidth={480}>
                <TableHead>
                  <TableRow hoverable={false}>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell align="right">Added</TableHeaderCell>
                    <TableHeaderCell align="right">Updated</TableHeaderCell>
                    <TableHeaderCell align="right">Skipped</TableHeaderCell>
                    <TableHeaderCell align="right">Invalid</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Object.entries(importReport.perType) as Array<[string, { added: number; updated: number; skipped: number; invalid: number }]>).map(
                    ([type, counts]) => (
                      <TableRow key={type}>
                        <TableCell>{type}</TableCell>
                        <TableCell align="right" mono>
                          {counts.added}
                        </TableCell>
                        <TableCell align="right" mono>
                          {counts.updated}
                        </TableCell>
                        <TableCell align="right" mono>
                          {counts.skipped}
                        </TableCell>
                        <TableCell align="right" mono>
                          {counts.invalid}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {importReport.errors.length > 0 && (
              <ul className={styles.importErrors}>
                {importReport.errors.map((entry, index) => (
                  <li key={index}>
                    {entry.entityType}
                    {entry.id !== undefined ? ` ${entry.id}` : ''}: {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {reloadOpen && (
        <ConfirmDialog
          open
          title="Reload the seed pack?"
          description="Admin edits are replaced by the committed seed files. Published learner content is refreshed from the seed. Learner progress is retained."
          confirmLabel="Reload seed pack"
          destructive
          busy={busy}
          onConfirm={() => void handleReloadSeed()}
          onClose={() => setReloadOpen(false)}
        />
      )}
    </AdminShell>
  );
}
