/**
 * Optional live AI provider (Anthropic). The app is fully functional without
 * it — mock mode is the default and the canonical puzzle experience. When a
 * key is configured, AI steps call the real API from the browser; tools,
 * retrieval, and failure injection stay local and deterministic.
 */

export interface LiveSettings {
  apiKey: string;
  model: string;
}

export const LIVE_MODELS = ['claude-sonnet-5', 'claude-haiku-4-5-20251001'] as const;

export async function callAnthropic(settings: LiveSettings, prompt: string, expectsJson: boolean): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: expectsJson ? `${prompt}\n\nRespond with the JSON object only — no markdown fences, no commentary.` : prompt,
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}
