/**
 * Behaviour tests for editing the estimation inputs and overriding a driver's complexity: every
 * edit must go through the state layer's use cases, and a cleared rate must read as blocked rather
 * than silently pricing the role at zero.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectPendingActions, stagePrerequisite, useActions, useActiveSession, useBusy } from '../../state';
import { EstimateWorkspace } from './EstimateWorkspace';
import { estimationConfigWithBlockedRole, sessionWithEstimate } from './estimateTestFixtures';
import { createActionsMock } from './testHelpers';

vi.mock('../../state', () => ({
  useActiveSession: vi.fn(),
  useActions: vi.fn(),
  useBusy: vi.fn(),
  selectPendingActions: vi.fn(),
  stagePrerequisite: vi.fn(),
}));

function renderWithBlockedRole() {
  const session = sessionWithEstimate({ estimationConfig: estimationConfigWithBlockedRole('qa-engineer') });
  const actions = createActionsMock();
  vi.mocked(useActiveSession).mockReturnValue(session);
  vi.mocked(useActions).mockReturnValue(actions);
  vi.mocked(useBusy).mockReturnValue(null);
  vi.mocked(stagePrerequisite).mockReturnValue(null);
  vi.mocked(selectPendingActions).mockReturnValue([]);
  render(<EstimateWorkspace />);
  return actions;
}

function renderStandard() {
  const session = sessionWithEstimate();
  const actions = createActionsMock();
  vi.mocked(useActiveSession).mockReturnValue(session);
  vi.mocked(useActions).mockReturnValue(actions);
  vi.mocked(useBusy).mockReturnValue(null);
  vi.mocked(stagePrerequisite).mockReturnValue(null);
  vi.mocked(selectPendingActions).mockReturnValue([]);
  render(<EstimateWorkspace />);
  return actions;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Rate card', () => {
  it('shows the blocked badge only for the role with no configured day rate', () => {
    renderWithBlockedRole();
    expect(screen.getAllByText('No rate - cost blocked').length).toBe(1);
  });

  it('clearing a role rate calls setRoleRate with null instead of zero', () => {
    const actions = renderStandard();
    const rateCard = screen.getByRole('heading', { name: 'Role-based rate card' }).closest('section') as HTMLElement;
    const row = within(rateCard).getByText('QA Engineer').closest('tr') as HTMLElement;
    const rateInput = within(row).getByRole('spinbutton');
    fireEvent.change(rateInput, { target: { value: '' } });
    expect(actions.setRoleRate).toHaveBeenCalledWith('qa-engineer', null);
  });

  it('editing a role rate calls setRoleRate with the new number', () => {
    const actions = renderStandard();
    const rateCard = screen.getByRole('heading', { name: 'Role-based rate card' }).closest('section') as HTMLElement;
    const row = within(rateCard).getByText('QA Engineer').closest('tr') as HTMLElement;
    const rateInput = within(row).getByRole('spinbutton');
    fireEvent.change(rateInput, { target: { value: '650' } });
    expect(actions.setRoleRate).toHaveBeenCalledWith('qa-engineer', 650);
  });
});

describe('Commercial presets', () => {
  it('applies the chosen preset', () => {
    const actions = renderStandard();
    const row = screen.getByText('Nearshore blended delivery (USD)').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Apply' }));
    expect(actions.applyCommercialPreset).toHaveBeenCalledWith('nearshore-delivery-usd');
  });
});

describe('Base effort table', () => {
  it('edits one driver-type x complexity cell without touching the others', () => {
    const actions = renderStandard();
    fireEvent.click(screen.getByRole('button', { name: /Base effort/ }));
    const row = screen.getByText('System integration').closest('tr') as HTMLElement;
    const highInput = within(row).getAllByRole('spinbutton').at(2) as HTMLElement;
    fireEvent.change(highInput, { target: { value: '40' } });

    expect(actions.updateEstimationConfig).toHaveBeenCalledTimes(1);
    interface BaseEffortPatch {
      baseEffort: { driverType: string; days: { complexity: string; value: number }[] }[];
    }
    const patch = vi.mocked(actions.updateEstimationConfig).mock.calls.at(0)?.at(0) as BaseEffortPatch;
    const integrationRow = patch.baseEffort.find((entry) => entry.driverType === 'integration');
    expect(integrationRow?.days.find((cell) => cell.complexity === 'High')?.value).toBe(40);
  });
});

describe('Driver complexity override', () => {
  it('setting a driver complexity override calls setDriverComplexity with the driver id and new level', () => {
    const actions = renderStandard();
    // WS_01 carries DRV_01 and DRV_02 (see estimation/testing/estimateFixtures.ts platformSuggestion()).
    const heading = screen.getByRole('heading', { name: /Workstream WS_01/ });
    const card = heading.closest('section') as HTMLElement;

    fireEvent.click(within(card).getByRole('button', { name: /Drivers, adjustments/ }));
    const row = within(card).getByText('DRV_01').closest('tr') as HTMLElement;
    const select = within(row).getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Very High' } });
    expect(actions.setDriverComplexity).toHaveBeenCalledWith('DRV_01', 'Very High');
  });
});
