import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

/**
 * Cost factor for every password hash this application creates.
 *
 * The dummy hash below is generated with this same value, so the two cannot
 * drift apart. A hardcoded dummy string would quietly become half the work if
 * this were ever raised, reintroducing exactly the timing channel it exists to
 * close.
 */
const BCRYPT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * A real bcrypt hash of a value nobody knows, used to spend the same CPU on a
 * login for an address that does not exist as on one that does.
 *
 * bcrypt is deliberately slow — that is the point of it — so "look the user
 * up, and return early if there is nobody" is a timing oracle. Without a
 * comparison on that path, an unauthenticated caller can enumerate which
 * addresses have accounts on a care platform by measuring responses, even
 * though the status code and body are identical.
 *
 * The hash must be *valid*: `bcrypt.compare` returns false almost immediately
 * for a malformed hash, which would reintroduce the channel. It is generated
 * eagerly at module load, once, rather than per call — a lazily built one
 * would make the first probe slow and every later one normal, which is its own
 * observable difference.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  randomBytes(32).toString('hex'),
  BCRYPT_ROUNDS,
);

/**
 * Spends a password comparison's worth of time and discards the answer.
 *
 * Never call this before deciding the response: the point is that the work
 * happens on the paths that return *early*, not instead of them.
 */
export const burnPasswordCompare = async (password: string): Promise<void> => {
  await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
};
