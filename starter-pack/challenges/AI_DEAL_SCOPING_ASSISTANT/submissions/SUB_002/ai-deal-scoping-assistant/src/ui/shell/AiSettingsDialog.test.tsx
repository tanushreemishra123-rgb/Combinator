import { fireEvent, render, screen } from '@testing-library/react';
import { AiSettingsDialog } from './AiSettingsDialog';
import type { AiSettings, LiveProviderOption } from '../../ai';

const PROVIDER_OPTIONS: LiveProviderOption[] = [
  {
    id: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    keyHelpUrl: 'https://console.groq.com/keys',
    freeTierNote: 'Free developer tier.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini (OpenAI-compatible)',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash'],
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    freeTierNote: 'Free tier covers Flash models.',
  },
];

const MOCK_SETTINGS: AiSettings = { mode: 'mock', providerId: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '' };

describe('AiSettingsDialog', () => {
  it('defaults to Mock AI mode and hides the live-only fields', () => {
    render(
      <AiSettingsDialog
        open
        settings={MOCK_SETTINGS}
        providerOptions={PROVIDER_OPTIONS}
        onSave={vi.fn()}
        onTest={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Mock AI mode (default)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Paste your API key')).not.toBeInTheDocument();
  });

  it('reveals provider, model and API-key fields when switched to live mode', () => {
    render(
      <AiSettingsDialog
        open
        settings={MOCK_SETTINGS}
        providerOptions={PROVIDER_OPTIONS}
        onSave={vi.fn()}
        onTest={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByText('Live AI mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Provider')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste your API key')).toBeInTheDocument();
  });

  it('calls onTest when the test-connection button is clicked', () => {
    const onTest = vi.fn();
    const liveSettings: AiSettings = { ...MOCK_SETTINGS, mode: 'live' };
    render(
      <AiSettingsDialog
        open
        settings={liveSettings}
        providerOptions={PROVIDER_OPTIONS}
        onSave={vi.fn()}
        onTest={onTest}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(onTest).toHaveBeenCalledTimes(1);
  });

  it('shows the test result once the caller supplies one', () => {
    const liveSettings: AiSettings = { ...MOCK_SETTINGS, mode: 'live' };
    render(
      <AiSettingsDialog
        open
        settings={liveSettings}
        providerOptions={PROVIDER_OPTIONS}
        onSave={vi.fn()}
        onTest={vi.fn()}
        onClose={vi.fn()}
        testResult={{ ok: true, message: 'Connected to Groq.' }}
      />,
    );
    expect(screen.getByText('Connected to Groq.')).toBeInTheDocument();
  });

  it('saves the edited draft (mode + API key) without mutating the caller until Save is clicked', () => {
    const onSave = vi.fn();
    render(
      <AiSettingsDialog
        open
        settings={MOCK_SETTINGS}
        providerOptions={PROVIDER_OPTIONS}
        onSave={onSave}
        onTest={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.change(screen.getByPlaceholderText('Paste your API key'), { target: { value: 'my-test-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mode: 'live', apiKey: 'my-test-key' }));
  });

  it('discards the edited draft when Cancel is clicked', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <AiSettingsDialog
        open
        settings={MOCK_SETTINGS}
        providerOptions={PROVIDER_OPTIONS}
        onSave={onSave}
        onTest={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
