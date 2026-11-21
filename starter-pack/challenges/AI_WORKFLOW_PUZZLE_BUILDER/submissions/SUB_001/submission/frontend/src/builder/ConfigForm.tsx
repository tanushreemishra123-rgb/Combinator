/**
 * Config form for the selected node, rendered entirely from the catalog's
 * field descriptors - there is no per-block form anywhere in the app.
 *
 * The one contract-driven special case is `tool.tool`: when the puzzle ships
 * `tools`, it becomes a select over those; otherwise it stays free text.
 */

import { useState } from 'react'
import { Lock, Trash2 } from 'lucide-react'
import type { BlockType, PuzzleDetail } from '@/api/types'
import { CATALOG, type FieldDescriptor } from '@/blocks/catalog'
import CategoryIcon from '@/components/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/** Radix selects cannot hold an empty string, so "not set" needs a sentinel. */
const UNSET = '__unset__'

type PuzzleTool = NonNullable<PuzzleDetail['tools']>[number]

interface Props {
  blockType: BlockType
  label: string
  config: Record<string, unknown>
  /** The puzzle's simulated tools, when it declares any. */
  tools?: PuzzleTool[]
  onLabelChange: (label: string) => void
  onConfigChange: (config: Record<string, unknown>) => void
  onDelete: () => void
  /** True while a run owns the workflow: look, do not touch. */
  readOnly?: boolean
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

/** JSON editor with its own draft text, so a half-typed object is not lost. */
function JsonField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: unknown
  onChange: (next: unknown) => void
}) {
  const [text, setText] = useState(() =>
    value === undefined || value === null ? '' : JSON.stringify(value, null, 2),
  )
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <Textarea
        className={cn('font-mono text-xs', error && 'border-destructive')}
        rows={Math.min(10, Math.max(3, text.split('\n').length))}
        value={text}
        spellCheck={false}
        placeholder={field.placeholder ?? '{ }'}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          if (next.trim() === '') {
            setError(null)
            onChange(undefined)
            return
          }
          try {
            onChange(JSON.parse(next) as unknown)
            setError(null)
          } catch {
            setError('Not valid JSON yet')
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  )
}

function MultiSelectField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor
  value: unknown
  onChange: (next: unknown) => void
}) {
  const selected = new Set(Array.isArray(value) ? value.map(String) : [])
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-2.5">
      {(field.options ?? []).map((option) => (
        <div key={option.value} className="flex items-center gap-2.5">
          <Switch
            id={`${field.name}-${option.value}`}
            checked={selected.has(option.value)}
            onCheckedChange={(on) => {
              const next = new Set(selected)
              if (on) next.add(option.value)
              else next.delete(option.value)
              onChange([...next])
            }}
          />
          <Label htmlFor={`${field.name}-${option.value}`} className="text-xs font-normal">
            {option.label}
          </Label>
        </div>
      ))}
    </div>
  )
}

export default function ConfigForm({
  blockType,
  label,
  config,
  tools,
  onLabelChange,
  onConfigChange,
  onDelete,
  readOnly = false,
}: Props) {
  const meta = CATALOG[blockType] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: blockType is the BlockType union, not user input

  const setValue = (name: string, value: unknown) => {
    const next = { ...config }
    if (value === undefined) delete next[name] // nosemgrep: gitlab.eslint.detect-object-injection -- name is a FieldDescriptor name from the catalog; `next` is a fresh plain object, not a prototype-bearing target
    else next[name] = value // nosemgrep: gitlab.eslint.detect-object-injection -- name is a FieldDescriptor name from the catalog; `next` is a fresh plain object, not a prototype-bearing target
    onConfigChange(next)
  }

  /** Contract: `PuzzleDetail.tools` drives a select for `tool.tool`. */
  const toolOptions = blockType === 'tool' && tools && tools.length > 0 ? tools : null

  const renderInput = (field: FieldDescriptor) => {
    const value = config[field.name] // nosemgrep: gitlab.eslint.detect-object-injection -- field.name is a literal from the block catalog's descriptors, not user input

    if (toolOptions && field.name === 'tool') {
      const current = asString(value)
      const known = toolOptions.some((tool) => tool.name === current)
      return (
        <Select
          value={known ? current : UNSET}
          onValueChange={(next) => setValue(field.name, next === UNSET ? undefined : next)}
        >
          <SelectTrigger className="w-full" aria-label={field.label}>
            <SelectValue placeholder="Pick a tool" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>- not set -</SelectItem>
            {toolOptions.map((tool) => (
              <SelectItem key={tool.name} value={tool.name}>
                {tool.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    switch (field.kind) {
      case 'checkbox':
        return (
          <div className="flex items-center gap-2.5">
            <Switch
              id={`field-${field.name}`}
              checked={value === true}
              onCheckedChange={(on) => setValue(field.name, on)}
            />
            <Label htmlFor={`field-${field.name}`} className="font-normal">
              {field.label}
            </Label>
          </div>
        )

      case 'number':
        return (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            value={typeof value === 'number' ? value : ''}
            placeholder={field.default === undefined ? '' : String(field.default)}
            onChange={(event) => {
              const raw = event.target.value
              setValue(field.name, raw === '' ? undefined : Number(raw))
            }}
          />
        )

      case 'select': {
        if (field.multiple) {
          return (
            <MultiSelectField
              field={field}
              value={value}
              onChange={(next) => setValue(field.name, next)}
            />
          )
        }
        const optional = !field.required && field.default === undefined
        const current = asString(value ?? field.default)
        return (
          <Select
            value={current === '' ? UNSET : current}
            onValueChange={(next) => setValue(field.name, next === UNSET ? undefined : next)}
          >
            <SelectTrigger className="w-full" aria-label={field.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {optional && <SelectItem value={UNSET}>- not set -</SelectItem>}
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }

      case 'json':
        return (
          <JsonField field={field} value={value} onChange={(next) => setValue(field.name, next)} />
        )

      case 'text':
      default:
        return field.multiline ? (
          <Textarea
            rows={3}
            value={asString(value)}
            placeholder={field.placeholder}
            onChange={(event) => setValue(field.name, event.target.value || undefined)}
          />
        ) : (
          <Input
            type="text"
            value={asString(value)}
            placeholder={field.placeholder ?? (field.default === undefined ? '' : String(field.default))}
            onChange={(event) => setValue(field.name, event.target.value || undefined)}
          />
        )
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <CategoryIcon type={blockType} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{meta.displayName}</p>
          <p className="text-xs leading-snug text-muted-foreground">
            {meta.description.split('-').slice(1).join('-').trim()}
          </p>
        </div>
      </header>

      <fieldset className="space-y-4 disabled:opacity-60" disabled={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="node-label">Name on the canvas</Label>
          <Input
            id="node-label"
            type="text"
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
          />
        </div>

        {meta.fields.map((field) => (
          <div className="space-y-1.5" key={field.name}>
            {field.kind !== 'checkbox' && (
              <Label className="gap-2">
                {field.label}
                {field.required && (
                  <span className="text-[0.65rem] font-medium tracking-wide text-primary uppercase">
                    required
                  </span>
                )}
              </Label>
            )}
            {renderInput(field)}
            {field.help && <p className="text-xs leading-snug text-muted-foreground">{field.help}</p>}
          </div>
        ))}
      </fieldset>

      {readOnly ? (
        <p className="flex items-center gap-2 rounded-xl bg-muted p-2.5 text-xs text-muted-foreground">
          <Lock aria-hidden="true" className="size-3.5" />
          Frozen while the run is in flight.
        </p>
      ) : (
        <Button variant="outline" className="w-full" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Remove this block
        </Button>
      )}
    </div>
  )
}
