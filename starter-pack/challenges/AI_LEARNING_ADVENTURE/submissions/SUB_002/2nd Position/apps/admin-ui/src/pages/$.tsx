import { useMemo, useState } from 'react';
import type { NextPage } from 'next';
import type { CSSProperties, ReactNode } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AttentionStrip,
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  FilterToolbar,
  IconButton,
  LoadingState,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Pagination,
  RadioGroup,
  SegmentedGroup,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  TabContent,
  TabList,
  TabTrigger,
  Tabs,
  TextArea,
  TextInput,
  Tooltip,
  Typography
} from '@/components/ui';

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.75rem'
};

function DemoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <Typography variant="card-title">{title}</Typography>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', marginTop: '0.75rem' }}>
        {children}
      </div>
    </section>
  );
}

const badgeVariants = ['success', 'danger', 'warning', 'neutral', 'draft', 'published', 'disabled'] as const;

const learners = [
  { id: 'L-1001', name: 'Ada Lovelace', email: 'ada@example.com', progress: 92, status: 'published' as const },
  { id: 'L-1002', name: 'Grace Hopper', email: 'grace@example.com', progress: 67, status: 'draft' as const },
  { id: 'L-1003', name: 'Alan Turing', email: 'alan@example.com', progress: 45, status: 'disabled' as const },
  { id: 'L-1004', name: 'Katherine Johnson', email: 'katherine@example.com', progress: 81, status: 'published' as const }
];

const ComponentGallery: NextPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(3);
  const [view, setView] = useState('table');
  const [emailDigest, setEmailDigest] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedLearners = useMemo(() => {
    const sorted = [...learners].sort((a, b) => a.name.localeCompare(b.name));
    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [sortDirection]);

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      <Typography variant="eyebrow">Admin UI</Typography>
      <Typography variant="page-title">Component gallery</Typography>
      <div style={{ marginBottom: '2rem' }}>
        <Typography variant="body-muted">A demo of every component in components/ui.</Typography>
      </div>

      <DemoSection title="Typography">
        <Typography variant="eyebrow">Eyebrow</Typography>
        <Typography variant="page-title" as="h2">
          Page title
        </Typography>
        <Typography variant="card-title" as="h3">
          Card title
        </Typography>
        <Typography variant="body">Body text for general content.</Typography>
        <Typography variant="body-muted">Muted body text for secondary information.</Typography>
        <Typography variant="mono">mono {`{ id: 'L-1001' }`}</Typography>
        <Typography variant="label-caps">Label caps</Typography>
        <div style={rowStyle}>
          <Typography color="success">Success</Typography>
          <Typography color="danger">Danger</Typography>
          <Typography color="warning">Warning</Typography>
          <Typography color="muted">Muted</Typography>
          <Typography weight="bold">Bold</Typography>
        </div>
      </DemoSection>

      <DemoSection title="Button">
        <div style={rowStyle}>
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div style={rowStyle}>
          <Button variant="primary" size="sm" iconLeft="+">
            Small with icon left
          </Button>
          <Button variant="outline" iconRight="→">Outline with icon right</Button>
        </div>
      </DemoSection>

      <DemoSection title="IconButton">
        <div style={rowStyle}>
          <IconButton aria-label="Edit">✎</IconButton>
          <IconButton aria-label="Delete">✕</IconButton>
          <IconButton aria-label="More options" active>
            ⋮
          </IconButton>
          <IconButton aria-label="Add" size="sm">
            +
          </IconButton>
          <IconButton aria-label="Locked" disabled>
            ⊘
          </IconButton>
        </div>
      </DemoSection>

      <DemoSection title="Badge">
        <div style={rowStyle}>
          {badgeVariants.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
          <Badge variant="neutral" mono>
            mono-001
          </Badge>
        </div>
      </DemoSection>

      <DemoSection title="AttentionStrip">
        <AttentionStrip
          items={[
            { id: 'att-1', message: '3 lessons are missing media assets', severity: 'warning', href: '#lessons' },
            { id: 'att-2', message: 'Publish pipeline failed at 09:12', severity: 'danger', onClick: () => setDialogOpen(true) },
            { id: 'att-3', message: 'Static informational note' }
          ]}
        />
      </DemoSection>

      <DemoSection title="TextInput">
        <TextInput label="Course title" defaultValue="Intro to Algorithms" hint="Shown to learners on the course card." />
        <TextInput label="Slug" error="Slug is already taken." rightMeta={<Badge variant="danger">taken</Badge>} />
        <TextInput label="Search" placeholder="Search learners…" aria-label="Search" />
      </DemoSection>

      <DemoSection title="TextArea">
        <TextArea label="Description" defaultValue="A hands-on tour of classic algorithms." hint="Markdown is supported." />
        <TextArea label="Reviewer notes" error="Notes must be at least 10 characters." rows={3} />
      </DemoSection>

      <DemoSection title="Select">
        <Select
          label="Status"
          defaultValue="published"
          options={[
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
            { label: 'Archived', value: 'archived', disabled: true }
          ]}
          hint="Controls learner visibility."
        />
        <Select label="Owner" placeholder="Pick an owner" options={[{ label: 'Ada Lovelace', value: 'ada' }]} error="An owner is required." />
      </DemoSection>

      <DemoSection title="Checkbox">
        <Checkbox label="Enable quizzes" description="Adds a quiz block after each lesson." defaultChecked />
        <Checkbox label="Indeterminate selection" indeterminate />
        <Checkbox label="Disabled option" disabled />
      </DemoSection>

      <DemoSection title="RadioGroup">
        <RadioGroup
          name="demo-enrollment"
          label="Enrollment mode"
          defaultValue="open"
          options={[
            { label: 'Open', value: 'open', description: 'Anyone can enroll.' },
            { label: 'Invite only', value: 'invite' },
            { label: 'Legacy', value: 'legacy', disabled: true }
          ]}
        />
        <RadioGroup
          name="demo-sort"
          label="Sort"
          orientation="horizontal"
          defaultValue="name"
          options={[
            { label: 'Name', value: 'name' },
            { label: 'Progress', value: 'progress' }
          ]}
        />
      </DemoSection>

      <DemoSection title="Switch">
        <Switch checked={emailDigest} onChange={setEmailDigest} label="Email digest" description="Send a daily summary to admins." />
        <Switch checked={weeklyReport} onChange={setWeeklyReport} label="Weekly report" />
        <Switch checked={false} label="Disabled switch" disabled />
      </DemoSection>

      <DemoSection title="SegmentedGroup">
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
        <SegmentedGroup
          aria-label="Density"
          size="sm"
          value="comfortable"
          options={[
            { label: 'Compact', value: 'compact' },
            { label: 'Comfortable', value: 'comfortable' }
          ]}
        />
      </DemoSection>

      <DemoSection title="FilterToolbar">
        <FilterToolbar>
          <TextInput placeholder="Filter by name…" aria-label="Filter by name" />
          <Select
            aria-label="Filter by status"
            defaultValue=""
            placeholder="All statuses"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Published', value: 'published' }
            ]}
          />
          <SegmentedGroup
            aria-label="Range"
            size="sm"
            value="7d"
            options={[
              { label: '7d', value: '7d' },
              { label: '30d', value: '30d' },
              { label: 'All', value: 'all' }
            ]}
          />
          <Button variant="outline" size="sm">
            Clear filters
          </Button>
        </FilterToolbar>
      </DemoSection>

      <DemoSection title="Table">
        <TableContainer>
          <Table minWidth={640}>
            <TableHead>
              <TableRow hoverable={false}>
                <TableHeaderCell
                  sortable
                  sorted={sortDirection}
                  onSort={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
                >
                  Learner
                </TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell align="right">Progress</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell align="center">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedLearners.map((learner) => (
                <TableRow key={learner.id} selected={learner.id === 'L-1002'}>
                  <TableCell>
                    {learner.name} <Typography variant="body-muted" as="span">({learner.id})</Typography>
                  </TableCell>
                  <TableCell mono>{learner.email}</TableCell>
                  <TableCell align="right" mono>
                    {learner.progress}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={learner.status}>{learner.status}</Badge>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton aria-label={`Edit ${learner.name}`} size="sm">
                      ✎
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow disabled>
                <TableCell>Locked row</TableCell>
                <TableCell mono>locked@example.com</TableCell>
                <TableCell align="right" mono>
                  0%
                </TableCell>
                <TableCell>
                  <Badge variant="disabled">disabled</Badge>
                </TableCell>
                <TableCell align="center" />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </DemoSection>

      <DemoSection title="Pagination">
        <Pagination page={page} pageCount={12} onPageChange={setPage} />
      </DemoSection>

      <DemoSection title="Tabs">
        <Tabs defaultValue="overview">
          <TabList aria-label="Course sections">
            <TabTrigger value="overview">Overview</TabTrigger>
            <TabTrigger value="curriculum">Curriculum</TabTrigger>
            <TabTrigger value="settings">Settings</TabTrigger>
            <TabTrigger value="danger" disabled>
              Danger zone
            </TabTrigger>
          </TabList>
          <TabContent value="overview">Overview panel content.</TabContent>
          <TabContent value="curriculum">Curriculum panel content.</TabContent>
          <TabContent value="settings">Settings panel content.</TabContent>
          <TabContent value="danger">You should not see this.</TabContent>
        </Tabs>
      </DemoSection>

      <DemoSection title="Accordion">
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
        <Accordion type="multiple" defaultValue={['a']}>
          <AccordionItem value="a">
            <AccordionHeader>Multiple (A)</AccordionHeader>
            <AccordionContent>Several items can stay open at once.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionHeader>Multiple (B)</AccordionHeader>
            <AccordionContent>Toggle freely.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </DemoSection>

      <DemoSection title="Menu">
        <Menu>
          <MenuTrigger>Course actions ▾</MenuTrigger>
          <MenuContent>
            <MenuItem icon="✎" onSelect={() => undefined}>
              Rename
            </MenuItem>
            <MenuItem icon="⧉">Duplicate</MenuItem>
            <MenuItem disabled>Archive (coming soon)</MenuItem>
            <MenuSeparator />
            <MenuItem destructive icon="✕">
              Delete course
            </MenuItem>
          </MenuContent>
        </Menu>
      </DemoSection>

      <DemoSection title="Tooltip">
        <div style={rowStyle}>
          <Tooltip content="Opens the publish dialog" side="top">
            <Button variant="outline">Hover me (top)</Button>
          </Tooltip>
          <Tooltip content="Bottom tooltip" side="bottom">
            <IconButton aria-label="Help">?</IconButton>
          </Tooltip>
        </div>
      </DemoSection>

      <DemoSection title="Dialog">
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          Open dialog
        </Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Publish course"
          description="Learners will see the latest content immediately."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                Publish
              </Button>
            </>
          }
        >
          <TextInput label="Release note" placeholder="What changed?" />
        </Dialog>
      </DemoSection>

      <DemoSection title="LoadingState">
        <LoadingState />
        <LoadingState label="Fetching learners…" />
      </DemoSection>

      <DemoSection title="EmptyState">
        <EmptyState
          title="No cohorts yet"
          description="Create your first cohort to start grouping learners."
          icon="○"
          action={<Button variant="primary">Create cohort</Button>}
        />
      </DemoSection>

      <DemoSection title="ErrorState">
        <ErrorState
          title="Failed to load enrollments"
          description="The API returned 503. Try again in a moment."
          action={<Button variant="outline">Retry</Button>}
        />
      </DemoSection>
    </main>
  );
};

export default ComponentGallery;
