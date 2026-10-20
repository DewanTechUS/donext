import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { todayISO } from '../lib/filters';
import { describe, expect, it, vi } from 'vitest';
import { SpeechError, type MicPermission, type SpeechHandlers, type SpeechService, type SpeechSupport } from '../lib/speech';
import { KEYS } from '../lib/storage';
import { TaskForm } from './TaskForm';

function fakeSpeech(opts: { support?: SpeechSupport; permission?: MicPermission } = {}) {
  let handlers: SpeechHandlers | null = null;
  const stop = vi.fn(() => handlers?.onEnd());
  const service: SpeechService = {
    support: () => opts.support ?? 'web',
    permission: async () => opts.permission ?? 'granted',
    start: vi.fn(async (h: SpeechHandlers) => {
      handlers = h;
      return { stop };
    }),
  };
  return {
    service,
    stop,
    say: (text: string) => handlers!.onTranscript(text),
    end: () => handlers!.onEnd(),
    fail: (code: SpeechError['code']) => handlers!.onError(new SpeechError(code)),
  };
}

function renderComposer(speech: SpeechService) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<TaskForm voice speech={speech} categories={[]} submitLabel="Add task" onSubmit={onSubmit} />);
  return { onSubmit, box: screen.getByRole('textbox', { name: 'Task' }), send: screen.getByRole('button', { name: 'Add task' }) };
}

const skipExplainer = () => localStorage.setItem(KEYS.micExplained, 'true');

describe('Voice composer', () => {
  it('types the words into the box live while you speak, and the arrow adds the task', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    const { onSubmit, box, send } = renderComposer(speech.service);
    expect(send).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true'));

    speech.say('buy milk');
    await waitFor(() => expect(box).toHaveValue('buy milk'));
    speech.say('buy milk and eggs');
    await waitFor(() => expect(box).toHaveValue('buy milk and eggs'));
    expect(onSubmit).not.toHaveBeenCalled(); // nothing is saved until the arrow

    await user.click(send);
    expect(speech.stop).toHaveBeenCalled();
    // Saving applies the smart suggestions: a grocery list becomes sub-items.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Buy groceries', category: 'Groceries', subtasks: [expect.objectContaining({ title: 'Milk' }), expect.objectContaining({ title: 'Eggs' })] }),
    );
  });

  it('ignores late speech results after the arrow is pressed', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    speech.stop.mockImplementation(() => undefined); // engine keeps sending results briefly
    const { onSubmit, box, send } = renderComposer(speech.service);

    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(speech.service.start).toHaveBeenCalled());
    speech.say('call mom');
    await waitFor(() => expect(box).toHaveValue('call mom'));
    await user.click(send);
    speech.say('call mom something else');
    expect(box).toHaveValue('call mom');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'call mom' }));
  });

  it('adds to text that is already in the box, and lets you edit before sending', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    const { onSubmit, box } = renderComposer(speech.service);

    await user.type(box, 'Call');
    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(speech.service.start).toHaveBeenCalled());
    speech.say('mum tomorow');
    await waitFor(() => expect(box).toHaveValue('Call mum tomorow'));

    // Typing while listening stops the mic so speech can't overwrite the correction.
    await user.type(box, '{Backspace}{Backspace}row');
    expect(speech.stop).toHaveBeenCalled();
    speech.say('ignored');
    expect(box).toHaveValue('Call mum tomorrow');

    await user.type(box, '{Enter}');
    // "tomorrow" becomes the due date when saving.
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Call mum', dueDate: todayISO(new Date(Date.now() + 864e5)) }));
  });

  it('still works as a typing box when voice is unavailable', async () => {
    const user = userEvent.setup();
    const { onSubmit, box } = renderComposer(fakeSpeech({ support: 'none' }).service);
    expect(screen.queryByRole('button', { name: 'Speak your task' })).not.toBeInTheDocument();
    expect(screen.getByText(/voice isn't available in this browser/i)).toBeInTheDocument();
    await user.type(box, 'Typed task{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Typed task' }));
  });

  it('explains microphone use before the first permission prompt', async () => {
    const user = userEvent.setup();
    const speech = fakeSpeech({ permission: 'prompt' });
    const { box } = renderComposer(speech.service);

    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    expect(screen.getByText('Allow microphone access?')).toBeInTheDocument();
    expect(speech.service.start).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(box).toHaveFocus();
    expect(speech.service.start).not.toHaveBeenCalled();
  });

  it('shows clear guidance when microphone permission is denied', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    renderComposer(speech.service);
    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(speech.service.start).toHaveBeenCalled());
    speech.fail('permission-denied');
    speech.end();
    expect(await screen.findByText(/microphone access was blocked/i)).toBeInTheDocument();
  });

  it('does not start when the browser already reports the permission as denied', async () => {
    const user = userEvent.setup();
    const speech = fakeSpeech({ permission: 'denied' });
    renderComposer(speech.service);
    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    expect(await screen.findByText(/microphone access was blocked/i)).toBeInTheDocument();
    expect(speech.service.start).not.toHaveBeenCalled();
  });

  it('tells the user when nothing was heard', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    renderComposer(speech.service);
    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(speech.service.start).toHaveBeenCalled());
    speech.end();
    expect(await screen.findByText(/didn't hear anything/i)).toBeInTheDocument();
  });

  it('keeps optional details behind a toggle and includes them when sending', async () => {
    const user = userEvent.setup();
    const { onSubmit, box } = renderComposer(fakeSpeech().service);
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add details/i }));
    await user.selectOptions(screen.getByLabelText('Priority'), 'high');
    await user.type(box, 'Pay rent{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pay rent', priority: 'high' }));
  });
});

describe('Hands-free voice', () => {
  it('saves a spoken task with its date, priority and reminder when you say "add it"', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    const { onSubmit } = renderComposer(speech.service);

    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(speech.service.start).toHaveBeenCalled());
    speech.say('Hey DoNext I have a job tomorrow at 9 priority high remind me 1 hour before add it');
    speech.end(); // the recogniser stops after the sentence

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Job',
          dueDate: todayISO(new Date(Date.now() + 864e5)),
          dueTime: '09:00',
          priority: 'high',
          reminderMinutes: 60,
        }),
      ),
    );
  });

  it('waits for the arrow when you don’t say "add it"', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    const { onSubmit } = renderComposer(speech.service);
    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(speech.service.start).toHaveBeenCalled());
    speech.say('call the dentist friday');
    speech.end();
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('runs commands such as "what do I have today?" and shows the answer', async () => {
    skipExplainer();
    const user = userEvent.setup();
    const speech = fakeSpeech();
    const onSubmit = vi.fn();
    const onCommand = vi.fn().mockResolvedValue({ text: 'You have 2 tasks today: Job and Pay rent.' });
    render(<TaskForm voice speech={speech.service} categories={[]} submitLabel="Add task" onSubmit={onSubmit} onCommand={onCommand} />);

    await user.click(screen.getByRole('button', { name: 'Speak your task' }));
    await waitFor(() => expect(speech.service.start).toHaveBeenCalled());
    speech.say('what do I have today');
    speech.end();

    expect(await screen.findByText('You have 2 tasks today: Job and Pay rent.')).toBeInTheDocument();
    expect(onCommand).toHaveBeenCalledWith({ kind: 'agenda', range: 'today' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
