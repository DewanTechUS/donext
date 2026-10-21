import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeechService } from '../lib/speech';

const speak = vi.fn();
vi.mock('../lib/sound', async (orig) => ({ ...(await orig<typeof import('../lib/sound')>()), canSpeak: () => true, speak: (t: string) => speak(t) }));

const { TaskForm } = await import('./TaskForm');
const { readAloudEnabled, setReadAloud } = await import('../lib/voicePrefs');

const noSpeech: SpeechService = { support: () => 'none', permission: async () => 'unknown', start: vi.fn() };

function renderComposer() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<TaskForm voice speech={noSpeech} categories={[]} submitLabel="Add task" onSubmit={onSubmit} />);
  return onSubmit;
}

describe('Read aloud', () => {
  beforeEach(() => {
    localStorage.clear();
    speak.mockClear();
  });

  it('is on by default and says what was added', async () => {
    expect(readAloudEnabled()).toBe(true);
    const user = userEvent.setup();
    const onSubmit = renderComposer();
    await user.type(screen.getByRole('textbox', { name: 'Task' }), 'Call the bank priority high');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('Added Call the bank, high priority.');
  });

  it('stays quiet when switched off with the 🔊 button', async () => {
    const user = userEvent.setup();
    const onSubmit = renderComposer();
    await user.click(screen.getByRole('button', { name: /Read aloud on/ }));
    expect(readAloudEnabled()).toBe(false);
    expect(screen.getByRole('button', { name: /Read aloud off/ })).toHaveAttribute('aria-pressed', 'false');
    await user.type(screen.getByRole('textbox', { name: 'Task' }), 'Call the bank');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    setReadAloud(true);
  });
});
