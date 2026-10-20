import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { todayISO } from '../lib/filters';
import type { SpeechService } from '../lib/speech';
import { TaskForm, validateTask, emptyFields } from './TaskForm';

const noSpeech: SpeechService = { support: () => 'none', permission: async () => 'unknown', start: vi.fn() };

describe('TaskForm', () => {
  it('requires a title and shows an accessible error', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TaskForm categories={[]} submitLabel="Add task" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    const title = screen.getByLabelText(/title/i);
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('Please enter a title.');
    expect(title).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits all fields', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm categories={['Work']} submitLabel="Add task" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/title/i), 'Ship release');
    await user.type(screen.getByLabelText(/description/i), 'v1.0');
    await user.selectOptions(screen.getByLabelText(/priority/i), 'high');
    await user.type(screen.getByLabelText(/category/i), 'Work');
    await user.type(screen.getByLabelText('Due date'), 'tomorrow 5:30 pm');
    expect(screen.getByText(/→ .*5:30 PM · .* left/)).toBeInTheDocument(); // "1 day" or "N hours", depending on the time now
    await user.tab();
    await user.type(screen.getByLabelText('New sub-item'), 'Write notes{Enter}');
    await user.type(screen.getByLabelText('New sub-item'), 'Tag build');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    await user.click(screen.getByLabelText('Mark sub-item 1 as done'));
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Ship release',
      description: 'v1.0',
      dueDate: todayISO(new Date(Date.now() + 864e5)),
      dueTime: '17:30',
      reminderMinutes: null,
      priority: 'high',
      category: 'Work',
      completed: false,
      subtasks: [
        { id: expect.any(String), title: 'Write notes', done: true },
        { id: expect.any(String), title: 'Tag build', done: false },
      ],
      listId: null,
      assigneeId: null,
    });
  });

  it('puts a task in a shared list and assigns it to a member of that list', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const lists = [
      {
        id: 'L1',
        name: 'Family',
        ownerId: 'me',
        role: 'owner' as const,
        members: [
          { id: 'me', name: 'Rocky', email: 'r@x.com', role: 'owner' as const },
          { id: 'u2', name: 'Sara', email: 's@x.com', role: 'member' as const },
        ],
        invites: [],
        createdAt: '',
        updatedAt: '',
      },
    ];
    render(<TaskForm categories={[]} lists={lists} meId="me" submitLabel="Add task" onSubmit={onSubmit} />);
    expect(screen.queryByLabelText('Assign to')).not.toBeInTheDocument(); // personal tasks can't be assigned

    await user.type(screen.getByLabelText(/title/i), 'Buy milk');
    await user.selectOptions(screen.getByLabelText('List'), 'L1');
    expect(screen.getByRole('option', { name: 'Rocky (me)' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Assign to'), 'u2');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Buy milk', listId: 'L1', assigneeId: 'u2' }));
  });

  it('shows a helpful message when saving fails', async () => {
    const user = userEvent.setup();
    render(
      <TaskForm categories={[]} submitLabel="Save" onSubmit={vi.fn().mockRejectedValue(new Error('Disk is full'))} />,
    );
    await user.type(screen.getByLabelText(/title/i), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk is full');
  });

  it('falls back to typing when voice is unavailable', () => {
    render(<TaskForm voice speech={noSpeech} categories={[]} submitLabel="Add" onSubmit={vi.fn()} />);
    expect(screen.getByText(/voice isn't available/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Task' })).toBeEnabled();
  });

  it('suggests a category and sub-items from the title and applies them', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm voice speech={noSpeech} categories={[]} submitLabel="Add" onSubmit={onSubmit} />);
    await user.type(screen.getByRole('textbox', { name: 'Task' }), 'milk eggs and bread');
    const card = screen.getByRole('region', { name: 'Suggestions' });
    expect(card).toHaveTextContent('Groceries');
    expect(card).toHaveTextContent('Milk, Eggs, Bread');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('region', { name: 'Suggestions' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Buy groceries',
        category: 'Groceries',
        subtasks: [
          { id: expect.any(String), title: 'Milk', done: false },
          { id: expect.any(String), title: 'Eggs', done: false },
          { id: expect.any(String), title: 'Bread', done: false },
        ],
      }),
    );
  });

  it('validates lengths', () => {
    expect(validateTask({ ...emptyFields, title: 'a'.repeat(201) }).title).toMatch(/200/);
    expect(validateTask({ ...emptyFields, title: 'ok', category: 'c'.repeat(51) }).category).toMatch(/50/);
    expect(validateTask({ ...emptyFields, title: 'ok' })).toEqual({});
  });
});
