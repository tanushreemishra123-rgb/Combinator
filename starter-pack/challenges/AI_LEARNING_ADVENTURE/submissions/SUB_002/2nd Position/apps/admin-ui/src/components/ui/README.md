# Admin UI components

Shared UI primitives for the admin app. Import everything from the barrel:

```tsx
import { Button, Dialog, Table } from '@/components/ui';
```

Each component is styled with its own CSS module (`Component.module.scss`) using the design tokens in `src/styles/_tokens.scss`. Do not mix in `learner-ui` styles.

Components that accept `className` merge it onto the root element via `cx`.

## Components

- [Accordion](#accordion)
- [AttentionStrip](#attentionstrip)
- [Badge](#badge)
- [Button](#button)
- [Checkbox](#checkbox)
- [cx](#cx)
- [Dialog](#dialog)
- [EmptyState](#emptystate)
- [ErrorState](#errorstate)
- [FilterToolbar](#filtertoolbar)
- [IconButton](#iconbutton)
- [LoadingState](#loadingstate)
- [Menu](#menu)
- [Pagination](#pagination)
- [RadioGroup](#radiogroup)
- [SegmentedGroup](#segmentedgroup)
- [Select](#select)
- [Switch](#switch)
- [Table](#table)
- [Tabs](#tabs)
- [TextArea](#textarea)
- [TextInput](#textinput)
- [Tooltip](#tooltip)
- [Typography](#typography)

## Accordion

Compound component: `Accordion` > `AccordionItem` > `AccordionHeader` + `AccordionContent`. Supports keyboard navigation between headers (ArrowUp/ArrowDown/Home/End). Uncontrolled via `defaultValue`, controlled via `value` + `onValueChange`.

### Accordion props

| Prop            | Type                          | Default    | Description                                              |
| --------------- | ----------------------------- | ---------- | -------------------------------------------------------- |
| `type`          | `'single' \| 'multiple'`      | `'single'` | How many items can be expanded at once.                  |
| `collapsible`   | `boolean`                     | `true`     | Whether an expanded item can be collapsed (`single` only). |
| `defaultValue`  | `string \| string[]`          | —          | Initially expanded value(s) (uncontrolled).              |
| `value`         | `string \| string[]`          | —          | Expanded value(s) (controlled).                          |
| `onValueChange` | `(value: string[]) => void`   | —          | Called with the updated expanded values.                 |
| `className`     | `string`                      | —          | Extra class for the root.                                |
| `children`      | `ReactNode`                   | required   | `AccordionItem` elements.                                |

### AccordionItem props

| Prop        | Type        | Default  | Description                          |
| ----------- | ----------- | -------- | ------------------------------------ |
| `value`     | `string`    | required | Unique value identifying this item.  |
| `className` | `string`    | —        | Extra class for the item.            |
| `children`  | `ReactNode` | required | `AccordionHeader` + `AccordionContent`. |

### AccordionHeader / AccordionContent props

| Prop        | Type        | Default  | Description             |
| ----------- | ----------- | -------- | ----------------------- |
| `className` | `string`    | —        | Extra class.            |
| `children`  | `ReactNode` | required | Header label / content. |

```tsx
<Accordion type="single" defaultValue="publishing">
  <AccordionItem value="publishing">
    <AccordionHeader>Publishing</AccordionHeader>
    <AccordionContent>Changes go live immediately after review.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="permissions">
    <AccordionHeader>Permissions</AccordionHeader>
    <AccordionContent>Only admins can edit published lessons.</AccordionContent>
  </AccordionItem>
</Accordion>
```

## AttentionStrip

Horizontal strip of items that need attention. Renders nothing when `items` is empty. Items render as a link (`href`), a button (`onClick`), or plain text.

| Prop        | Type               | Default              | Description                  |
| ----------- | ------------------ | -------------------- | ---------------------------- |
| `title`     | `string`           | `'Needs attention'`  | Accessible label of the strip. |
| `items`     | `AttentionItem[]`  | required             | Items to display.            |
| `className` | `string`           | —                    | Extra class for the root.    |

### AttentionItem

| Prop       | Type                              | Default     | Description                              |
| ---------- | --------------------------------- | ----------- | ---------------------------------------- |
| `id`       | `string`                          | required    | Unique key.                              |
| `message`  | `ReactNode`                       | required    | Item text/content.                       |
| `severity` | `'warning' \| 'danger'`           | `'warning'` | Visual severity.                         |
| `href`     | `string`                          | —           | Renders the message as a link.           |
| `onClick`  | `() => void`                      | —           | Renders the message as a button.         |

```tsx
<AttentionStrip
  items={[
    { id: 'att-1', message: '3 lessons are missing media assets', severity: 'warning', href: '#lessons' },
    { id: 'att-2', message: 'Publish pipeline failed at 09:12', severity: 'danger', onClick: handleRetry }
  ]}
/>
```

## Badge

Status label.

| Prop        | Type                                                                                   | Default     | Description           |
| ----------- | -------------------------------------------------------------------------------------- | ----------- | --------------------- |
| `variant`   | `'success' \| 'danger' \| 'warning' \| 'neutral' \| 'draft' \| 'published' \| 'disabled'` | `'neutral'` | Color scheme.         |
| `mono`      | `boolean`                                                                              | `false`     | Use the monospace font. |
| `className` | `string`                                                                               | —           | Extra class.          |
| `children`  | `ReactNode`                                                                            | required    | Label content.        |

```tsx
<Badge variant="published">published</Badge>
<Badge variant="neutral" mono>L-1001</Badge>
```

## Button

Extends `ButtonHTMLAttributes<HTMLButtonElement>` (all native button props are forwarded; `type` defaults to `'button'`).

| Prop        | Type                                          | Default     | Description                          |
| ----------- | --------------------------------------------- | ----------- | ------------------------------------ |
| `variant`   | `'primary' \| 'outline' \| 'ghost' \| 'danger'` | `'outline'` | Visual style.                        |
| `size`      | `'sm' \| 'md'`                                | `'md'`      | Height/padding.                      |
| `iconLeft`  | `ReactNode`                                   | —           | Icon rendered before the label.      |
| `iconRight` | `ReactNode`                                   | —           | Icon rendered after the label.       |
| `className` | `string`                                      | —           | Extra class.                         |

```tsx
<Button variant="primary" iconLeft="+">Create course</Button>
<Button variant="danger" size="sm" disabled>Delete</Button>
```

## Checkbox

Extends `Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>` (native input props are forwarded). Renders an optional label and description next to the box.

| Prop            | Type        | Default | Description                              |
| --------------- | ----------- | ------- | ---------------------------------------- |
| `label`         | `ReactNode` | —       | Label text.                              |
| `description`   | `ReactNode` | —       | Secondary text under the label.          |
| `indeterminate` | `boolean`   | `false` | Shows the indeterminate (mixed) state.   |
| `className`     | `string`    | —       | Extra class for the wrapping label.      |

```tsx
<Checkbox label="Enable quizzes" description="Adds a quiz block after each lesson." defaultChecked />
<Checkbox label="Select all" indeterminate onChange={handleSelectAll} />
```

## cx

Class name joiner used across the library. Exported for convenience.

```ts
function cx(...parts: Array<string | false | null | undefined>): string;
```

```tsx
<div className={cx(styles.row, isActive && styles.active)} />
```

## Dialog

Modal rendered in a portal on `document.body`. Handles focus trapping, Escape to close, and body scroll locking. Portal rendering is deferred until mount, so it is SSR-safe.

| Prop                  | Type                    | Default | Description                                  |
| --------------------- | ----------------------- | ------- | -------------------------------------------- |
| `open`                | `boolean`               | required | Visibility.                                  |
| `onClose`             | `() => void`            | required | Called on Escape, close button, or overlay click. |
| `title`               | `ReactNode`             | required | Dialog title.                                |
| `description`         | `ReactNode`             | —       | Optional description under the title.        |
| `size`                | `'sm' \| 'md' \| 'lg'`  | `'md'`  | Dialog width.                                |
| `children`            | `ReactNode`             | —       | Body content.                                |
| `footer`              | `ReactNode`             | —       | Footer content (usually action buttons).     |
| `closeOnOverlayClick` | `boolean`               | `true`  | Whether clicking the overlay closes it.      |

```tsx
const [open, setOpen] = useState(false);

<Button variant="primary" onClick={() => setOpen(true)}>Publish</Button>
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Publish course"
  description="Learners will see the latest content immediately."
  footer={
    <>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handlePublish}>Publish</Button>
    </>
  }
>
  <TextInput label="Release note" placeholder="What changed?" />
</Dialog>
```

## EmptyState

Placeholder for empty lists/panels.

| Prop          | Type        | Default  | Description                          |
| ------------- | ----------- | -------- | ------------------------------------ |
| `title`       | `string`    | required | Main message.                        |
| `description` | `string`    | —        | Supporting text.                     |
| `icon`        | `ReactNode` | —        | Icon rendered above the title.       |
| `action`      | `ReactNode` | —        | Call to action (usually a `Button`). |
| `className`   | `string`    | —        | Extra class.                         |

```tsx
<EmptyState
  title="No cohorts yet"
  description="Create your first cohort to start grouping learners."
  action={<Button variant="primary">Create cohort</Button>}
/>
```

## ErrorState

Error placeholder with `role="alert"`.

| Prop          | Type        | Default                  | Description                       |
| ------------- | ----------- | ------------------------ | --------------------------------- |
| `title`       | `string`    | `'Something went wrong'` | Main message.                     |
| `description` | `string`    | —                        | Supporting text.                  |
| `action`      | `ReactNode` | —                        | Recovery action (e.g. retry).     |
| `className`   | `string`    | —                        | Extra class.                      |

```tsx
<ErrorState
  title="Failed to load enrollments"
  description="The API returned 503. Try again in a moment."
  action={<Button variant="outline">Retry</Button>}
/>
```

## FilterToolbar

Layout container for filter controls. Extends `HTMLAttributes<HTMLDivElement>`.

```tsx
<FilterToolbar>
  <TextInput placeholder="Filter by name…" aria-label="Filter by name" />
  <Select aria-label="Filter by status" placeholder="All statuses" options={statusOptions} onChange={setStatus} />
  <Button variant="outline" size="sm">Clear filters</Button>
</FilterToolbar>
```

## IconButton

Square icon-only button. Extends `ButtonHTMLAttributes<HTMLButtonElement>` (`type` defaults to `'button'`).

| Prop         | Type           | Default  | Description                              |
| ------------ | -------------- | -------- | ---------------------------------------- |
| `aria-label` | `string`       | required | Accessible name (required).              |
| `size`       | `'sm' \| 'md'` | `'md'`   | Button size.                             |
| `active`     | `boolean`      | `false`  | Active/pressed appearance.               |
| `className`  | `string`       | —        | Extra class.                             |

```tsx
<IconButton aria-label="Edit" onClick={handleEdit}>✎</IconButton>
<IconButton aria-label="More options" size="sm" active>⋮</IconButton>
```

## LoadingState

Spinner with label, `role="status"`.

| Prop        | Type     | Default      | Description       |
| ----------- | -------- | ------------ | ----------------- |
| `label`     | `string` | `'Loading…'` | Status text.      |
| `className` | `string` | —            | Extra class.      |

```tsx
<LoadingState label="Fetching learners…" />
```

## Menu

Compound dropdown menu: `Menu` > `MenuTrigger` + `MenuContent` > `MenuItem` / `MenuSeparator`. The content renders in a portal, is positioned relative to the trigger, and supports full keyboard navigation (ArrowUp/ArrowDown/Home/End/Escape/Tab).

### Menu props

| Prop       | Type                 | Default  | Description                              |
| ---------- | -------------------- | -------- | ---------------------------------------- |
| `align`    | `'start' \| 'end'`   | `'end'`  | Horizontal alignment to the trigger.     |
| `children` | `ReactNode`          | required | `MenuTrigger` + `MenuContent`.           |

### MenuTrigger props

Extends `ButtonHTMLAttributes<HTMLButtonElement>`. Sets `aria-haspopup`/`aria-expanded` automatically.

### MenuContent props

| Prop        | Type        | Default  | Description              |
| ----------- | ----------- | -------- | ------------------------ |
| `className` | `string`    | —        | Extra class.             |
| `children`  | `ReactNode` | required | `MenuItem` elements.     |

### MenuItem props

| Prop          | Type        | Default | Description                                  |
| ------------- | ----------- | ------- | -------------------------------------------- |
| `onSelect`    | `() => void`| —       | Called when the item is clicked.             |
| `disabled`    | `boolean`   | `false` | Disables the item.                           |
| `destructive` | `boolean`   | `false` | Danger styling.                              |
| `icon`        | `ReactNode` | —       | Icon rendered before the label.              |
| `className`   | `string`    | —       | Extra class.                                 |
| `children`    | `ReactNode` | required| Label content.                               |

### MenuSeparator

No props. Renders a `role="separator"` divider.

```tsx
<Menu>
  <MenuTrigger>Course actions ▾</MenuTrigger>
  <MenuContent>
    <MenuItem icon="✎" onSelect={handleRename}>Rename</MenuItem>
    <MenuItem icon="⧉" onSelect={handleDuplicate}>Duplicate</MenuItem>
    <MenuItem disabled>Archive (coming soon)</MenuItem>
    <MenuSeparator />
    <MenuItem destructive icon="✕" onSelect={handleDelete}>Delete course</MenuItem>
  </MenuContent>
</Menu>
```

## Pagination

Page navigation with previous/next buttons and ellipsis collapsing. Returns `null` when `pageCount <= 1`.

| Prop         | Type                      | Default        | Description                     |
| ------------ | ------------------------- | -------------- | ------------------------------- |
| `page`       | `number`                  | required       | Current page (1-based).         |
| `pageCount`  | `number`                  | required       | Total number of pages.          |
| `onPageChange` | `(page: number) => void`| required       | Called with the requested page. |
| `className`  | `string`                  | —              | Extra class.                    |
| `aria-label` | `string`                  | `'Pagination'` | Accessible label of the nav.    |

```tsx
const [page, setPage] = useState(1);

<Pagination page={page} pageCount={12} onPageChange={setPage} />
```

## RadioGroup

Fieldset-based radio group. Controlled via `value`, uncontrolled via `defaultValue`.

### RadioGroup props

| Prop           | Type                          | Default      | Description                          |
| -------------- | ----------------------------- | ------------ | ------------------------------------ |
| `name`         | `string`                      | required     | Shared input name.                   |
| `label`        | `ReactNode`                   | —            | Group legend.                        |
| `value`        | `string`                      | —            | Selected value (controlled).         |
| `defaultValue` | `string`                      | —            | Initially selected value.            |
| `options`      | `RadioOption[]`               | required     | Options to render.                   |
| `onChange`     | `(value: string) => void`     | —            | Called when selection changes.       |
| `orientation`  | `'vertical' \| 'horizontal'`  | `'vertical'` | Layout direction.                    |
| `disabled`     | `boolean`                     | `false`      | Disables the whole group.            |
| `className`    | `string`                      | —            | Extra class.                         |

### RadioOption

| Prop          | Type        | Default  | Description                 |
| ------------- | ----------- | -------- | --------------------------- |
| `label`       | `ReactNode` | required | Option label.               |
| `value`       | `string`    | required | Option value.               |
| `description` | `ReactNode` | —        | Secondary text.             |
| `disabled`    | `boolean`   | —        | Disables this option.       |

```tsx
<RadioGroup
  name="enrollment-mode"
  label="Enrollment mode"
  defaultValue="open"
  onChange={setMode}
  options={[
    { label: 'Open', value: 'open', description: 'Anyone can enroll.' },
    { label: 'Invite only', value: 'invite' },
    { label: 'Legacy', value: 'legacy', disabled: true }
  ]}
/>
```

## SegmentedGroup

Segmented control (`role="radiogroup"` of buttons). Controlled: requires `value` + `onChange`.

### SegmentedGroup props

| Prop         | Type                  | Default  | Description                        |
| ------------ | --------------------- | -------- | ---------------------------------- |
| `value`      | `string`              | required | Active segment value.              |
| `onChange`   | `(value: string) => void` | —    | Called when a segment is clicked.  |
| `options`    | `SegmentedOption[]`   | required | Segments to render.                |
| `size`       | `'sm' \| 'md'`        | `'md'`   | Segment height/padding.            |
| `aria-label` | `string`              | —        | Accessible label of the group.     |
| `className`  | `string`              | —        | Extra class.                       |

### SegmentedOption

| Prop       | Type        | Default  | Description            |
| ---------- | ----------- | -------- | ---------------------- |
| `label`    | `ReactNode` | required | Segment label.         |
| `value`    | `string`    | required | Segment value.         |
| `disabled` | `boolean`   | —        | Disables the segment.  |

```tsx
const [view, setView] = useState('table');

<SegmentedGroup
  aria-label="View mode"
  value={view}
  onChange={setView}
  options={[
    { label: 'Table', value: 'table' },
    { label: 'Grid', value: 'grid' },
    { label: 'Timeline', value: 'timeline', disabled: true }
  ]}
/>
```

## Select

Native select with label, hint, and error wiring. Controlled via `value`, uncontrolled via `defaultValue`.

| Prop           | Type                      | Default  | Description                                  |
| -------------- | ------------------------- | -------- | -------------------------------------------- |
| `id`           | `string`                  | auto     | Input id (auto-generated when omitted).      |
| `name`         | `string`                  | —        | Form field name.                             |
| `label`        | `string`                  | —        | Visible label.                               |
| `value`        | `string`                  | —        | Selected value (controlled).                 |
| `defaultValue` | `string`                  | —        | Initially selected value.                    |
| `placeholder`  | `string`                  | —        | Disabled hidden option shown when no value.  |
| `options`      | `SelectOption[]`          | required | Options to render.                           |
| `onChange`     | `(value: string) => void` | —        | Called with the selected value.              |
| `disabled`     | `boolean`                 | `false`  | Disables the select.                         |
| `hint`         | `string`                  | —        | Help text (hidden when `error` is set).      |
| `error`        | `string`                  | —        | Error text; marks the field invalid.         |
| `className`    | `string`                  | —        | Extra class for the field wrapper.           |
| `aria-label`   | `string`                  | —        | Accessible label when no visible `label`.    |

### SelectOption

| Prop       | Type      | Default  | Description          |
| ---------- | --------- | -------- | -------------------- |
| `label`    | `string`  | required | Option text.         |
| `value`    | `string`  | required | Option value.        |
| `disabled` | `boolean` | —        | Disables the option. |

```tsx
<Select
  label="Status"
  defaultValue="published"
  hint="Controls learner visibility."
  options={[
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived', disabled: true }
  ]}
  onChange={setStatus}
/>
```

## Switch

Toggle switch (`role="switch"`). Controlled: requires `checked` + `onChange`.

| Prop          | Type                            | Default  | Description                              |
| ------------- | ------------------------------- | -------- | ---------------------------------------- |
| `checked`     | `boolean`                       | required | On/off state.                            |
| `onChange`    | `(checked: boolean) => void`    | —        | Called with the next state.              |
| `label`       | `ReactNode`                     | —        | Label text.                              |
| `description` | `ReactNode`                     | —        | Secondary text under the label.          |
| `disabled`    | `boolean`                       | `false`  | Disables the switch.                     |
| `id`          | `string`                        | —        | Input id.                                |
| `aria-label`  | `string`                        | —        | Accessible label when no visible label.  |
| `className`   | `string`                        | —        | Extra class.                             |

```tsx
const [digest, setDigest] = useState(true);

<Switch checked={digest} onChange={setDigest} label="Email digest" description="Send a daily summary to admins." />
```

## Table

Compound data table: `TableContainer` > `Table` > `TableHead`/`TableBody` > `TableRow` > `TableHeaderCell`/`TableCell`.

`TableContainer` is a scroll wrapper that shows edge indicators when the table overflows horizontally.

### TableContainer props

Extends `HTMLAttributes<HTMLDivElement>`.

### Table props

Extends `HTMLAttributes<HTMLTableElement>`.

| Prop        | Type               | Default | Description                          |
| ----------- | ------------------ | ------- | ------------------------------------ |
| `minWidth`  | `string \| number` | —       | Minimum table width (enables scroll).|

### TableHead / TableBody props

Extend `HTMLAttributes<HTMLTableSectionElement>`.

### TableRow props

Extends `HTMLAttributes<HTMLTableRowElement>`.

| Prop        | Type      | Default | Description                 |
| ----------- | --------- | ------- | --------------------------- |
| `hoverable` | `boolean` | `true`  | Hover background.           |
| `selected`  | `boolean` | `false` | Selected appearance.        |
| `disabled`  | `boolean` | `false` | Dimmed appearance.          |

### TableHeaderCell props

Extends `ThHTMLAttributes<HTMLTableCellElement>`.

| Prop       | Type                              | Default  | Description                                |
| ---------- | --------------------------------- | -------- | ------------------------------------------ |
| `align`    | `'left' \| 'center' \| 'right'`   | `'left'` | Content alignment.                         |
| `sortable` | `boolean`                         | `false`  | Renders a sort button.                     |
| `sorted`   | `'asc' \| 'desc' \| null`         | `null`   | Current sort direction (sets `aria-sort`). |
| `onSort`   | `() => void`                      | —        | Called when the sort button is clicked.    |

### TableCell props

Extends `TdHTMLAttributes<HTMLTableCellElement>`.

| Prop    | Type                            | Default  | Description              |
| ------- | ------------------------------- | -------- | ------------------------ |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | Content alignment.       |
| `mono`  | `boolean`                       | `false`  | Monospace font.          |

```tsx
<TableContainer>
  <Table minWidth={640}>
    <TableHead>
      <TableRow hoverable={false}>
        <TableHeaderCell sortable sorted={sortDirection} onSort={toggleSort}>
          Learner
        </TableHeaderCell>
        <TableHeaderCell>Email</TableHeaderCell>
        <TableHeaderCell align="right">Progress</TableHeaderCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {learners.map((learner) => (
        <TableRow key={learner.id} selected={learner.id === selectedId}>
          <TableCell>{learner.name}</TableCell>
          <TableCell mono>{learner.email}</TableCell>
          <TableCell align="right" mono>{learner.progress}%</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

## Tabs

Compound tabs: `Tabs` > `TabList` > `TabTrigger` + `TabContent` panels. Supports keyboard navigation (ArrowLeft/ArrowRight/Home/End). Uncontrolled via `defaultValue`, controlled via `value` + `onValueChange`. Also exported as `TabsRoot`.

### Tabs props

| Prop            | Type                      | Default | Description                        |
| --------------- | ------------------------- | ------- | ---------------------------------- |
| `defaultValue`  | `string`                  | —       | Initially active tab (uncontrolled).|
| `value`         | `string`                  | —       | Active tab (controlled).           |
| `onValueChange` | `(value: string) => void` | —       | Called when a tab is selected.     |
| `className`     | `string`                  | —       | Extra class for the root.          |
| `children`      | `ReactNode`               | required| `TabList` + `TabContent` elements. |

### TabList props

| Prop         | Type        | Default  | Description                     |
| ------------ | ----------- | -------- | ------------------------------- |
| `aria-label` | `string`    | —        | Accessible label of the tablist.|
| `className`  | `string`    | —        | Extra class.                    |
| `children`   | `ReactNode` | required | `TabTrigger` elements.          |

### TabTrigger props

| Prop        | Type        | Default  | Description                  |
| ----------- | ----------- | -------- | ---------------------------- |
| `value`     | `string`    | required | Tab value.                   |
| `disabled`  | `boolean`   | `false`  | Disables the tab.            |
| `className` | `string`    | —        | Extra class.                 |
| `children`  | `ReactNode` | required | Tab label.                   |

### TabContent props

| Prop        | Type        | Default  | Description                              |
| ----------- | ----------- | -------- | ---------------------------------------- |
| `value`     | `string`    | required | Tab value this panel belongs to.         |
| `className` | `string`    | —        | Extra class.                             |
| `children`  | `ReactNode` | required | Panel content (hidden unless active).    |

```tsx
<Tabs defaultValue="overview">
  <TabList aria-label="Course sections">
    <TabTrigger value="overview">Overview</TabTrigger>
    <TabTrigger value="curriculum">Curriculum</TabTrigger>
    <TabTrigger value="settings">Settings</TabTrigger>
  </TabList>
  <TabContent value="overview">Overview panel content.</TabContent>
  <TabContent value="curriculum">Curriculum panel content.</TabContent>
  <TabContent value="settings">Settings panel content.</TabContent>
</Tabs>
```

## TextArea

Extends `TextareaHTMLAttributes<HTMLTextAreaElement>` (native textarea props are forwarded; `rows` defaults to `4`). Label, hint, and error are wired with `aria-describedby`.

| Prop        | Type     | Default | Description                              |
| ----------- | -------- | ------- | ---------------------------------------- |
| `label`     | `string` | —       | Visible label.                           |
| `hint`      | `string` | —       | Help text (hidden when `error` is set).  |
| `error`     | `string` | —       | Error text; marks the field invalid.     |
| `className` | `string` | —       | Extra class for the field wrapper.       |

```tsx
<TextArea label="Description" defaultValue="A hands-on tour of classic algorithms." hint="Markdown is supported." />
<TextArea label="Reviewer notes" error="Notes must be at least 10 characters." rows={3} />
```

## TextInput

Extends `Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>` (native input props are forwarded). Label, hint, and error are wired with `aria-describedby`.

| Prop        | Type        | Default | Description                              |
| ----------- | ----------- | ------- | ---------------------------------------- |
| `label`     | `string`    | —       | Visible label.                           |
| `hint`      | `string`    | —       | Help text (hidden when `error` is set).  |
| `error`     | `string`    | —       | Error text; marks the field invalid.     |
| `rightMeta` | `ReactNode` | —       | Content rendered at the right edge (e.g. a `Badge`). |
| `className` | `string`    | —       | Extra class for the field wrapper.       |

```tsx
<TextInput label="Course title" defaultValue="Intro to Algorithms" hint="Shown to learners on the course card." />
<TextInput label="Slug" error="Slug is already taken." rightMeta={<Badge variant="danger">taken</Badge>} />
<TextInput placeholder="Search learners…" aria-label="Search" />
```

## Tooltip

Wraps a single child element and shows a bubble on hover/focus. The child must accept `aria-describedby` (any DOM element or component forwarding it).

| Prop       | Type                                      | Default  | Description                    |
| ---------- | ----------------------------------------- | -------- | ------------------------------ |
| `content`  | `ReactNode`                               | required | Tooltip content.               |
| `side`     | `'top' \| 'bottom' \| 'left' \| 'right'`  | `'top'`  | Placement relative to child.   |
| `children` | `ReactElement`                            | required | Single trigger element.        |

```tsx
<Tooltip content="Opens the publish dialog" side="top">
  <Button variant="outline">Publish</Button>
</Tooltip>
```

## Typography

Text styles mapped to design tokens. Does not accept a `style` prop; use `className` for overrides.

| Prop        | Type                                                                                     | Default            | Description                                          |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------- |
| `variant`   | `'eyebrow' \| 'page-title' \| 'card-title' \| 'body' \| 'body-muted' \| 'mono' \| 'label-caps'` | `'body'` | Text style.                              |
| `as`        | `'h1' \| 'h2' \| 'h3' \| 'p' \| 'span' \| 'div' \| 'label'`                              | per variant        | Rendered tag (defaults: `page-title`→`h1`, `card-title`→`h2`, `body`/`body-muted`→`p`, others→`span`). |
| `color`     | `'primary' \| 'secondary' \| 'muted' \| 'success' \| 'danger' \| 'warning'`              | —                  | Text color override.                                 |
| `weight`    | `'regular' \| 'medium' \| 'semibold' \| 'bold'`                                          | —                  | Font weight override.                                |
| `truncate`  | `boolean \| number`                                                                      | —                  | `true`/`1`: single-line ellipsis; `>1`: line clamp.  |
| `className` | `string`                                                                                 | —                  | Extra class.                                         |
| `id`        | `string`                                                                                 | —                  | Element id.                                          |
| `htmlFor`   | `string`                                                                                 | —                  | Only applied when the tag is `label`.                |
| `children`  | `ReactNode`                                                                              | —                  | Text content.                                        |

```tsx
<Typography variant="eyebrow">Admin UI</Typography>
<Typography variant="page-title">Courses</Typography>
<Typography variant="card-title" as="h3">Publishing</Typography>
<Typography variant="body-muted" truncate={2}>Long description that clamps to two lines…</Typography>
<Typography variant="mono">L-1001</Typography>
<Typography color="danger" weight="semibold">Required</Typography>
```
