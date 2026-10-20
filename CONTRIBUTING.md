# Contributing to DoNext

Thanks for your interest! DoNext is open source under the [MIT License](LICENSE). You're welcome to use it, learn from it, fork it and build on it.

## Ways to help

- **Report a bug:** open an issue with steps to reproduce it, what you expected, and what happened. Screenshots help.
- **Suggest a feature:** open an issue describing the problem it solves.
- **Send a pull request:**
  1. Fork the repo and create a branch: `git checkout -b my-change`.
  2. Install and run it: `npm install`, then `npm run dev:memory` (no database setup needed).
  3. Make your change and add or update tests.
  4. Make sure everything passes: `npm run typecheck` and `npm test`.
  5. Open a pull request explaining what changed and why.

## Guidelines

- Match the existing code style: TypeScript, React function components and Tailwind classes.
- Keep the UI accessible: labelled controls, keyboard support, and touch targets of 44 px or more.
- Never commit secrets: `.env` files, passwords or signing keys.

## Using DoNext in your own project

The code is MIT-licensed, so you can modify it and use it in your own projects, including commercial ones, as long as you keep the copyright notice in `LICENSE`.

The MIT License covers the **code only**. The **DoNext** name and logo are trademarks of Dewan Mahmud and are **not** included. If you publish your own version, you **must** use your own name and logo. See the [Trademark Policy](TRADEMARKS.md), and follow the [Rebranding guide](docs/REBRANDING.md); it only takes a few minutes.

Pull requests to *this* repository are, of course, part of DoNext itself.
