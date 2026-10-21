import { useId, useRef, useState, type FormEvent } from 'react';
import { PRIORITIES, type Priority, type SharedList, type TaskFields } from '../lib/types';
import { Alert } from './Alert';
import { describeLead, LEAD_OPTIONS, loadReminderSettings } from '../lib/reminders';
import { DueDateField } from './DueDatePicker';
import { SmartSuggestions, suggestionFor } from './SmartSuggestions';
import { canSpeak, speak } from '../lib/sound';
import { readAloudEnabled } from '../lib/voicePrefs';
import { ReadAloudToggle } from './ReadAloudToggle';
import { parseVoiceCommand, spokenConfirmation, type VoiceCommand } from '../lib/voiceCommand';
import { Spinner } from './Spinner';
import { SubtaskEditor } from './SubtaskEditor';
import { VoiceInput } from './VoiceInput';
import type { SpeechService } from '../lib/speech';

export const emptyFields: TaskFields = {
  title: '',
  description: '',
  dueDate: null,
  dueTime: null,
  reminderMinutes: null,
  priority: 'medium',
  category: '',
  completed: false,
  subtasks: [],
  listId: null,
  assigneeId: null,
};

export function validateTask(f: TaskFields): Partial<Record<keyof TaskFields, string>> {
  const errors: Partial<Record<keyof TaskFields, string>> = {};
  if (!f.title.trim()) errors.title = 'Please enter a title.';
  else if (f.title.trim().length > 200) errors.title = 'Title must be 200 characters or fewer.';
  if (f.description.length > 2000) errors.description = 'Description must be 2000 characters or fewer.';
  if (f.category.trim().length > 50) errors.category = 'Category must be 50 characters or fewer.';
  if (f.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.dueDate)) errors.dueDate = 'Please choose a valid date.';
  if (f.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.dueTime)) errors.dueTime = 'Please choose a valid time.';
  return errors;
}

interface TaskFormProps {
  initial?: TaskFields;
  categories: string[];
  /** Shared lists I belong to (enables the List and Assign to fields). */
  lists?: SharedList[];
  /** My user id (to label "me" among list members). */
  meId?: string;
  submitLabel: string;
  onSubmit: (fields: TaskFields) => Promise<void>;
  onCancel?: () => void;
  /**
   * Voice composer mode (for new tasks): a centred mic and a chat-style box that fills in
   * as you speak, with a send arrow. Other fields are tucked behind "Add details".
   */
  voice?: boolean;
  speech?: SpeechService;
  /**
   * Runs a voice command said or typed into the composer ("mark the job as done",
   * "what do I have today?") and returns the reply to show and read aloud.
   */
  onCommand?: (cmd: Exclude<VoiceCommand, { kind: 'add' }>) => Promise<{ text: string; done?: boolean }>;
}

export function TaskForm({
  initial = emptyFields,
  categories,
  lists = [],
  meId,
  submitLabel,
  onSubmit,
  onCancel,
  voice,
  speech,
  onCommand,
}: TaskFormProps) {
  const [fields, setFields] = useState<TaskFields>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  /** Reply to a voice command, shown under the composer. */
  const [reply, setReply] = useState<string | null>(null);
  /** The title for which the suggestions card was dismissed. */
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const titleRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const id = useId();
  const ids = {
    title: `${id}-title`,
    description: `${id}-description`,
    dueDate: `${id}-due`,
    reminder: `${id}-reminder`,
    priority: `${id}-priority`,
    category: `${id}-category`,
    categories: `${id}-categories`,
    details: `${id}-details`,
    list: `${id}-list`,
    assignee: `${id}-assignee`,
  };

  const set = <K extends keyof TaskFields>(key: K, value: TaskFields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Saves the task (or runs a voice command); confirmations are read aloud when Read aloud is on. */
  const save = async (base: TaskFields) => {
    let f = base;
    if (voice) {
      const cmd = parseVoiceCommand(base.title);
      if (cmd.kind !== 'add' && onCommand) {
        setSaving(true);
        setFormError(null);
        try {
          const res = await onCommand(cmd);
          setReply(res.text);
          if (readAloudEnabled() && canSpeak()) speak(res.text);
          if (res.done) setFields((x) => ({ ...x, title: '' }));
        } catch (err) {
          setFormError(err instanceof Error ? err.message : 'That didn’t work. Please try again.');
        } finally {
          setSaving(false);
        }
        return;
      }
      // Fill in what was said ("tomorrow at 9, priority high, remind me 1 hour before"),
      // unless the user dismissed the suggestions.
      if (dismissedFor !== base.title) f = { ...f, ...suggestionFor(base, categories).patch };
      if (cmd.kind === 'add' && f.title === base.title) f = { ...f, title: cmd.text || base.title };
    }
    const v = validateTask(f);
    setErrors(v);
    if (Object.keys(v).length) {
      if (!v.title) setShowDetails(true); // the problem is in one of the detail fields
      titleRef.current?.focus();
      return;
    }
    setFields(f);
    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(f);
      // Say what was added ("Added Job, tomorrow at 9:00 AM, high priority…").
      if (voice && readAloudEnabled() && canSpeak()) speak(spokenConfirmation(f));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(fields);
  };

  /** Listening stopped: run commands and "…, add it" right away, hands-free. */
  const onSpeechEnd = (text: string) => {
    const cmd = parseVoiceCommand(text);
    if (cmd.kind !== 'add' || cmd.submit) void save({ ...fieldsRef.current, title: text });
  };

  const errProps = (key: keyof TaskFields) =>
    errors[key] ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-${key}-error` } : {};

  const titleField = voice ? (
    <VoiceInput
      ref={(el) => {
        titleRef.current = el;
      }}
      inputId={ids.title}
      value={fields.title}
      onChange={(text) => {
        set('title', text);
        setReply(null);
      }}
      onSpeechEnd={onSpeechEnd}
      error={errors.title}
      submitting={saving}
      speech={speech}
    />
  ) : (
    <div>
      <label htmlFor={ids.title} className="label">
        Title <span aria-hidden className="text-red-600">*</span>
      </label>
      <input
        id={ids.title}
        ref={(el) => {
          titleRef.current = el;
        }}
        className="input"
        value={fields.title}
        onChange={(e) => set('title', e.target.value)}
        maxLength={200}
        required
        autoComplete="off"
        enterKeyHint="done"
        placeholder="What needs doing?"
        {...errProps('title')}
      />
      {errors.title && (
        <p id={`${id}-title-error`} className="field-error">
          {errors.title}
        </p>
      )}
    </div>
  );

  const selectedList = lists.find((l) => l.id === fields.listId);
  const listFields =
    lists.length > 0 ? (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.list} className="label">
            List
          </label>
          <select
            id={ids.list}
            className="input"
            value={fields.listId ?? ''}
            onChange={(e) => {
              const listId = e.target.value || null;
              const next = lists.find((l) => l.id === listId);
              setFields((f) => ({
                ...f,
                listId,
                // Keep the assignee only if they're in the newly chosen list.
                assigneeId: next && f.assigneeId && next.members.some((m) => m.id === f.assigneeId) ? f.assigneeId : null,
              }));
            }}
          >
            <option value="">Personal (only me)</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} (shared)
              </option>
            ))}
          </select>
        </div>
        {selectedList && (
          <div>
            <label htmlFor={ids.assignee} className="label">
              Assign to
            </label>
            <select
              id={ids.assignee}
              className="input"
              value={fields.assigneeId ?? ''}
              onChange={(e) => set('assigneeId', e.target.value || null)}
            >
              <option value="">Nobody</option>
              {selectedList.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === meId ? `${m.name} (me)` : m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    ) : null;

  const detailFields = (
    <div id={ids.details} className="space-y-4">
      <div>
        <label htmlFor={ids.description} className="label">
          Description
        </label>
        <textarea
          id={ids.description}
          className="input min-h-[88px]"
          value={fields.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={2000}
          placeholder="Optional details"
          {...errProps('description')}
        />
        {errors.description && (
          <p id={`${id}-description-error`} className="field-error">
            {errors.description}
          </p>
        )}
      </div>

      <DueDateField
        id={ids.dueDate}
        date={fields.dueDate}
        time={fields.dueTime}
        onChange={({ date, time }) => {
          // A reminder needs a due date.
          setFields((f) => ({ ...f, dueDate: date, dueTime: time, reminderMinutes: date ? f.reminderMinutes : null }));
          setErrors((er) => ({ ...er, dueDate: undefined, dueTime: undefined }));
        }}
      />

      {fields.dueDate && (
        <div>
          <label htmlFor={ids.reminder} className="label">
            Reminder
          </label>
          <select
            id={ids.reminder}
            className="input"
            value={fields.reminderMinutes ?? 'default'}
            onChange={(e) => set('reminderMinutes', e.target.value === 'default' ? null : Number(e.target.value))}
          >
            <option value="default">My default ({describeLead(loadReminderSettings().lead).toLowerCase()})</option>
            {[...LEAD_OPTIONS.map((o) => o.value), ...(fields.reminderMinutes !== null && fields.reminderMinutes >= 0 && !LEAD_OPTIONS.some((o) => o.value === fields.reminderMinutes) ? [fields.reminderMinutes] : [])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {describeLead(m)}
                </option>
              ))}
            <option value={-1}>No reminder</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={ids.priority} className="label">
            Priority
          </label>
          <select
            id={ids.priority}
            className="input"
            value={fields.priority}
            onChange={(e) => set('priority', e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.category} className="label">
            Category
          </label>
          <input
            id={ids.category}
            className="input"
            list={ids.categories}
            value={fields.category}
            onChange={(e) => set('category', e.target.value)}
            maxLength={50}
            placeholder="e.g. Work"
            {...errProps('category')}
          />
          <datalist id={ids.categories}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {errors.category && (
            <p id={`${id}-category-error`} className="field-error">
              {errors.category}
            </p>
          )}
        </div>
      </div>

      <SubtaskEditor value={fields.subtasks} onChange={(subtasks) => set('subtasks', subtasks)} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert onDismiss={() => setFormError(null)}>{formError}</Alert>}

      {titleField}

      {voice && reply && (
        <Alert kind="success" onDismiss={() => setReply(null)}>
          {reply}
        </Alert>
      )}

      {voice && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {!fields.title.trim() && !reply ? <>Try: “Job tomorrow at 9, priority high, add it”</> : null}
          </p>
          <ReadAloudToggle />
        </div>
      )}

      {voice && (
        <SmartSuggestions
          fields={fields}
          categories={categories}
          dismissed={dismissedFor === fields.title}
          onDismiss={() => setDismissedFor(fields.title)}
          onApply={(patch) => {
            setFields((f) => ({ ...f, ...patch }));
            setErrors({});
            setShowDetails(true); // show what was filled in
          }}
        />
      )}

      {listFields}

      {voice ? (
        <>
          <div className="flex justify-center">
            <button
              type="button"
              className="btn-ghost text-sm"
              aria-expanded={showDetails}
              aria-controls={ids.details}
              onClick={() => setShowDetails((s) => !s)}
            >
              {showDetails ? 'Hide details' : '+ Add details (date, time, priority, sub-items)'}
            </button>
          </div>
          {showDetails && detailFields}
        </>
      ) : (
        <>
          {detailFields}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel && (
              <button type="button" className="btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner label="Saving" className="h-4 w-4" />}
              {submitLabel}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
