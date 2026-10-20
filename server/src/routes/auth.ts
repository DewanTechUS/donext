import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import type { Config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { passwordResetEmail, type Mailer } from '../lib/mailer.js';
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateProfileSchema,
} from '../lib/validation.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { List } from '../models/List.js';
import { Task, toTaskDTO, type TaskAttrs } from '../models/Task.js';
import { User, toPublicUser } from '../models/User.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the email doesn't exist so response timing doesn't reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('donext-timing-equaliser', BCRYPT_ROUNDS);
const RESET_MINUTES = 60;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function authRouter(config: Config, opts: { authRateLimit: number; mailer: Mailer }): Router {
  const router = Router();
  const auth = requireAuth(config.JWT_SECRET);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: opts.authRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  });

  const issue = (user: { _id: unknown; tokenVersion?: number | null }) =>
    signToken(String(user._id), user.tokenVersion ?? 0, config.JWT_SECRET, config.JWT_EXPIRES_IN);

  router.post('/signup', limiter, async (req, res) => {
    const { name, email, password } = parse(signupSchema, req.body);
    if (await User.exists({ email })) {
      throw new HttpError(409, 'An account with this email already exists. Try logging in instead.');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    try {
      const user = await User.create({ name, email, passwordHash });
      res.status(201).json({ token: issue(user), user: toPublicUser(user) });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new HttpError(409, 'An account with this email already exists. Try logging in instead.');
      }
      throw err;
    }
  });

  router.post('/login', limiter, async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Incorrect email or password.');
    res.json({ token: issue(user), user: toPublicUser(user) });
  });

  router.get('/me', auth, async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(404, 'Account not found.');
    res.json({ user: toPublicUser(user) });
  });

  /**
   * Starts a password reset. Always answers the same way so it can't be used to discover
   * which emails have accounts; the email is sent in the background for the same reason.
   */
  router.post('/forgot-password', limiter, async (req, res) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    const user = await User.findOne({ email });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordResetHash: sha256(token), passwordResetExpires: new Date(Date.now() + RESET_MINUTES * 60_000) } },
      );
      const link = `${config.APP_URL}/reset-password?token=${token}`;
      opts.mailer
        .send({ to: user.email, ...passwordResetEmail(user.name, link, RESET_MINUTES) })
        .catch((err) => console.error('Failed to send password reset email:', err));
    }
    res.json({ message: "If an account exists for that email, we've sent a link to reset your password." });
  });

  /** Completes a reset with the emailed token. Signs out every other device. */
  router.post('/reset-password', limiter, async (req, res) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    const hash = sha256(token);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.findOneAndUpdate(
      { passwordResetHash: hash, passwordResetExpires: { $gt: new Date() } },
      { $set: { passwordHash }, $unset: { passwordResetHash: 1, passwordResetExpires: 1 }, $inc: { tokenVersion: 1 } },
      { new: true },
    );
    if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
    res.json({ token: issue(user), user: toPublicUser(user) });
  });

  router.patch('/me', auth, async (req, res) => {
    const { name } = parse(updateProfileSchema, req.body);
    const user = await User.findByIdAndUpdate(req.userId, { $set: { name } }, { new: true, runValidators: true });
    if (!user) throw new HttpError(404, 'Account not found.');
    res.json({ user: toPublicUser(user) });
  });

  /** Changes the password and signs out every other device; returns a fresh token for this one. */
  router.post('/change-password', limiter, auth, async (req, res) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    const user = await User.findById(req.userId).select('+passwordHash');
    if (!user) throw new HttpError(404, 'Account not found.');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(403, 'Your current password is incorrect.', { fields: { currentPassword: 'Incorrect password' } });
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    res.json({ token: issue(user), user: toPublicUser(user) });
  });

  /** Downloads everything stored for this account as JSON (data portability). */
  router.get('/export', auth, async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(404, 'Account not found.');
    const tasks = await Task.find({ user: user._id, deletedAt: null }).sort({ createdAt: 1 }).lean<TaskAttrs[]>();
    res.setHeader('Content-Disposition', 'attachment; filename="donext-export.json"');
    res.json({ exportedAt: new Date().toISOString(), app: 'DoNext', user: toPublicUser(user), tasks: tasks.map(toTaskDTO) });
  });

  /** Invalidates every token issued for this account (all devices). */
  router.post('/logout-all', auth, async (req, res) => {
    await User.updateOne({ _id: req.userId }, { $inc: { tokenVersion: 1 } });
    res.status(204).end();
  });

  /** Permanently deletes the account and all of its tasks. Requires password re-entry. */
  router.delete('/me', limiter, auth, async (req, res) => {
    const { password } = parse(deleteAccountSchema, req.body);
    const user = await User.findById(req.userId).select('+passwordHash');
    if (!user) throw new HttpError(404, 'Account not found.');
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(403, 'Incorrect password. Your account was not deleted.');
    }
    const now = new Date();
    // Lists this person owns are deleted for everyone, with their tasks.
    const owned = (await List.find({ owner: user._id }).select('_id').lean()).map((l) => l._id);
    await Task.deleteMany({ listId: { $in: owned } });
    await List.deleteMany({ _id: { $in: owned } });
    // In other people's lists, their tasks stay for the team (handed to the list owner) and assignments are cleared.
    for (const l of await List.find({ 'members.user': user._id }).select('_id owner').lean()) {
      await Task.updateMany({ listId: l._id, user: user._id }, { $set: { user: l.owner, updatedAt: now, serverUpdatedAt: now } });
      await Task.updateMany({ listId: l._id, assignee: user._id }, { $set: { assignee: null, updatedAt: now, serverUpdatedAt: now } });
    }
    await List.updateMany({ 'members.user': user._id }, { $pull: { members: { user: user._id } } });
    await List.updateMany({}, { $pull: { invites: { $or: [{ invitedBy: user._id }, { email: user.email }] } } });
    await Task.deleteMany({ user: user._id });
    await User.deleteOne({ _id: user._id });
    res.status(204).end();
  });

  return router;
}
