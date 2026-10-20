import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { TasksProvider } from '../context/TasksContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Header } from './Header';

function renderHeader() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <TasksProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Header />
          </MemoryRouter>
        </TasksProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('Header mobile menu', () => {
  it('collects navigation, theme and footer links in one menu', async () => {
    const user = userEvent.setup();
    renderHeader();
    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Sign up free' })).toBeInTheDocument();
    expect(within(menu).getByRole('group', { name: 'Color theme' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Help & Support' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: /DewanMahmud.com/ })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Dewan Mahmud' })).toBeInTheDocument(); // © credit
    expect(menu).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes with Escape or the close button and returns focus to the menu button', async () => {
    const user = userEvent.setup();
    renderHeader();
    const opener = screen.getByRole('button', { name: 'Open menu' });

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('closes after choosing a page', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: 'Terms of Service' }));
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });
});
