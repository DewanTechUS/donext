import { describe, expect, it } from 'vitest';
import { suggestTask } from './smartSuggest';

// Tuesday, Oct 13 2026, 10:00 local time
const now = new Date(2026, 9, 13, 10, 0);
const say = (text: string, categories: string[] = []) => suggestTask(text, { now, categories });

describe('spoken tasks', () => {
  it('understands "Hey DoNext, I have a job tomorrow, priority high"', () => {
    expect(say('Hey DoNext, I have a job tomorrow, priority high')).toMatchObject({
      title: 'Job',
      dueDate: '2026-10-14',
      priority: 'high',
    });
  });

  it('reads the time, priority and a reminder in one sentence', () => {
    expect(say('Hey DoNext I have a job tomorrow at 9 priority high remind me 1 hour before')).toMatchObject({
      title: 'Job',
      dueDate: '2026-10-14',
      dueTime: '09:00',
      priority: 'high',
      reminderMinutes: 60,
    });
    expect(say('dentist friday 3pm, remind me thirty minutes before')).toMatchObject({
      title: 'Dentist',
      category: 'Health',
      dueDate: '2026-10-16',
      dueTime: '15:00',
      reminderMinutes: 30,
    });
    expect(say('pay rent friday, remind me a day before').reminderMinutes).toBe(1440);
  });

  it('turns "remind me at 8am" into minutes before the due time', () => {
    // Date-only tasks are due at 9:00 AM for reminders.
    expect(say('job interview tomorrow, remind me at 8am')).toMatchObject({ dueDate: '2026-10-14', reminderMinutes: 60 });
    expect(say('team meeting friday at 2pm, remind me at 1:30 pm')).toMatchObject({ dueTime: '14:00', reminderMinutes: 30 });
    // No due date: the reminder time becomes the due time.
    expect(say('call mom, remind me at 6pm')).toMatchObject({ title: 'Call mom', dueDate: '2026-10-13', dueTime: '18:00', reminderMinutes: 0 });
  });

  it('treats due date, end date and deadline as the due date', () => {
    expect(say('Submit the report, due date Friday 5pm, priority low')).toMatchObject({
      title: 'Submit the report',
      dueDate: '2026-10-16',
      dueTime: '17:00',
      priority: 'low',
    });
    expect(say('pay rent end date october 30 no reminder')).toMatchObject({
      title: 'Pay rent',
      category: 'Bills',
      dueDate: '2026-10-30',
      reminderMinutes: -1,
    });
    expect(say('tax forms deadline next friday').dueDate).toBe('2026-10-16');
  });

  it('takes spoken sub-items, notes, categories and "add it"', () => {
    expect(say('Pack for trip with sub-items passport, charger and tickets')).toMatchObject({
      title: 'Pack for trip',
      category: 'Travel',
      subtasks: ['Passport', 'Charger', 'Tickets'],
    });
    expect(say('buy flowers with a note get red roses').description).toBe('Get red roses');
    expect(say('I need to renew my passport category travel, add it')).toMatchObject({ title: 'Renew my passport', category: 'Travel' });
    expect(say('remind me to call the bank tomorrow')).toMatchObject({ title: 'Call the bank', dueDate: '2026-10-14' });
  });

  it('keeps an explicit medium priority and plain "at 3" times', () => {
    expect(say('clean the garage today priority medium').priority).toBe('medium');
    expect(say('meeting at 3').dueTime).toBe('15:00');
    expect(say('breakfast at 8').dueTime).toBe('08:00');
  });
});
