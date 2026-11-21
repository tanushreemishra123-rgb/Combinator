import { fireEvent, render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';
import type { DataTableColumn } from './DataTable';

interface Row {
  id: string;
  name: string;
  detail: string;
}

const ROWS: Row[] = [
  { id: 'r1', name: 'First row', detail: 'First detail' },
  { id: 'r2', name: 'Second row', detail: 'Second detail' },
];

const COLUMNS: DataTableColumn<Row>[] = [{ id: 'name', header: 'Name', render: (row) => row.name }];

describe('DataTable', () => {
  it('shows the default empty state when there are no rows', () => {
    render(<DataTable columns={COLUMNS} rows={[]} getRowId={(row: Row) => row.id} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
  });

  it('renders a caller-supplied empty state instead of the default one', () => {
    render(<DataTable columns={COLUMNS} rows={[]} getRowId={(row: Row) => row.id} emptyState={<p>Nothing here yet</p>} />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
  });

  it('renders one row per item using each column render function', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowId={(row: Row) => row.id} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('First row')).toBeInTheDocument();
    expect(screen.getByText('Second row')).toBeInTheDocument();
  });

  it('hides row detail until the row is expanded, then shows it', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(row: Row) => row.id}
        renderExpanded={(row) => <p>{row.detail}</p>}
      />,
    );
    expect(screen.queryByText('First detail')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Expand row' }).at(0) as HTMLElement);
    expect(screen.getByText('First detail')).toBeInTheDocument();
    expect(screen.queryByText('Second detail')).not.toBeInTheDocument();
  });

  it('collapses an expanded row back when toggled again', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(row: Row) => row.id}
        renderExpanded={(row) => <p>{row.detail}</p>}
      />,
    );
    const toggle = screen.getAllByRole('button', { name: 'Expand row' }).at(0) as HTMLElement;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse row' }));
    expect(screen.queryByText('First detail')).not.toBeInTheDocument();
  });
});
