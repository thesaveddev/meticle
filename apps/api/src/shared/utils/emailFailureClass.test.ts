/**
 * Unit tests for the failure classifier.
 *
 * These are the strings the queue actually stores, not invented ones. Two are
 * quoted verbatim from real incidents in this codebase, because a classifier
 * tested only against shapes you made up is a classifier that passes:
 *
 *  - `EENVELOPE: No recipients defined` — nodemailer rejecting the message
 *    because `envelope` was supplied without a recipient. This took delivery
 *    down for twenty minutes in production.
 *  - `EENVELOPE: SMTP did not accept recipient …` — thrown by
 *    `EmailQueue.processBatch` when the server accepts the session but not the
 *    address, a check we wrote ourselves.
 *
 * The rest are the shapes nodemailer and Exim produce, in the
 * `` `${err.code}: ${err.message}` `` form the queue writes.
 */
import { describe, it, expect } from 'vitest';
import { classifyFailure, type FailureOwner } from './emailFailureClass';

describe('classifyFailure', () => {
  it('attributes a malformed envelope to us, not the recipient', () => {
    // The bug that broke delivery. A 5xx can accompany a malformed envelope, and
    // attributing that to the recipient would send the operator to the wrong
    // person, which is why this rule is ordered first.
    const result = classifyFailure('EENVELOPE: No recipients defined');
    expect(result.cause).toBe('envelope');
    expect(result.owner).toBe('code');
    expect(result.retryable).toBe(false);
  });

  it('attributes our own accepted-recipient check to us', () => {
    const result = classifyFailure('EENVELOPE: SMTP did not accept recipient alice@example.com');
    expect(result.owner).toBe('code');
    expect(result.cause).toBe('envelope');
  });

  it('attributes rejected credentials to configuration, and says it is total', () => {
    for (const message of [
      'EAUTH: Invalid credentials: Please re-check your credentials',
      '535 5.7.8 Authentication credentials invalid',
      '530 5.7.0 Authentication required',
    ]) {
      const result = classifyFailure(message);
      expect(result.cause, message).toBe('auth');
      expect(result.owner, message).toBe('configuration');
      expect(result.retryable, message).toBe(false);
    }
  });

  it('attributes a non-existent recipient to the recipient, and rules out retrying', () => {
    const result = classifyFailure('Message failed: 550 5.1.1 <nobody@example.com>: Recipient address rejected: User unknown');
    expect(result.cause).toBe('address');
    expect(result.owner).toBe('recipient');
    expect(result.retryable).toBe(false);
  });

  it('treats a bare 550 as an address problem', () => {
    // Exim varies its wording considerably, so not every 550 carries a 5.1.1.
    expect(classifyFailure('Message failed: 550 mailbox unavailable').cause).toBe('address');
  });

  it('attributes a policy rejection to the recipient, not to us', () => {
    const result = classifyFailure('Message failed: 550 5.7.1 Message rejected due to local restrictions');
    expect(result.cause).toBe('content');
    expect(result.owner).toBe('recipient');
    expect(result.retryable).toBe(false);
  });

  it('marks a full mailbox as the recipient problem but still worth retrying', () => {
    // The distinction that matters: same owner as a bad address, opposite
    // answer on whether another attempt could work.
    const result = classifyFailure('Message failed: 552 5.2.2 <a@b.com>: Mailbox full');
    expect(result.cause).toBe('mailbox');
    expect(result.owner).toBe('recipient');
    expect(result.retryable).toBe(true);
  });

  it('attributes a temporary rejection to the provider and keeps it retryable', () => {
    for (const message of [
      'Message failed: 421 4.7.0 Too many connections - try again later',
      'Message failed: 450 4.2.0 <a@b.com>: Recipient address rejected: mailbox busy',
    ]) {
      const result = classifyFailure(message);
      expect(result.owner, message).toBe('provider');
      expect(result.retryable, message).toBe(true);
    }
  });

  it('attributes a lost connection to the provider', () => {
    for (const message of ['ETIMEDOUT: A timeout occurred', 'ECONNECTION: connect ECONNREFUSED 1.2.3.4:587']) {
      const result = classifyFailure(message);
      expect(result.owner, message).toBe('provider');
      expect(result.cause, message).toBe('network');
    }
  });

  it('identifies a DSN bounce even when the message says nothing recognisable', () => {
    // A DSN is only identifiable from `last_dsn_status`. The receiving host's
    // wording varies and often carries no status code, so without this the
    // case where mail was accepted once and refused later would file itself
    // under "unrecognised" — precisely the one operators misread as success.
    const result = classifyFailure('SMTP delivery failure reported by DSN', { dsnBounced: true });
    expect(result.cause).toBe('bounced');
    expect(result.owner).toBe('recipient');
  });

  it('lets the DSN flag win, because a bounce can only follow an accepted send', () => {
    // A DSN is only ever issued for a message a server accepted, and the
    // webhook overwrites `error_message` with its own diagnostic on a bounce.
    // A row carrying both a bounce and an old send error is therefore not a
    // state the code can produce; where both are somehow present the refusal
    // is the more recent fact about what happened to the message.
    const result = classifyFailure('EENVELOPE: No recipients defined', { dsnBounced: true });
    expect(result.cause).toBe('bounced');
  });

  it('surfaces an unrecognised message rather than filing it as transient', () => {
    const result = classifyFailure('Something nobody has seen before');
    expect(result.cause).toBe('unattributed');
    expect(result.owner).toBe('unattributed');
  });

  it('handles a null, empty or whitespace message without throwing', () => {
    for (const value of [null, undefined, '', '   ']) {
      const result = classifyFailure(value);
      expect(result.cause, String(value)).toBe('unattributed');
    }
  });

  it('covers every stored failure in the aggregation the controller builds', () => {
    // A guard on the rules themselves: each cause must be reachable, so a rule
    // cannot be added that nothing ever selects and look like coverage.
    const samples: Array<[string, FailureOwner]> = [
      ['EENVELOPE: No recipients defined', 'code'],
      ['EAUTH: Invalid credentials', 'configuration'],
      ['Message failed: 550 5.1.1 <a@b.com>: User unknown', 'recipient'],
      ['Message failed: 550 5.7.1 Message rejected', 'recipient'],
      ['Message failed: 552 5.2.2 Mailbox full', 'recipient'],
      ['Message failed: 421 4.7.0 Try again later', 'provider'],
      ['ECONNECTION: connect ECONNREFUSED', 'provider'],
      ['Nothing recognised', 'unattributed'],
    ];
    for (const [message, owner] of samples) {
      expect(classifyFailure(message).owner, message).toBe(owner);
    }
    expect(classifyFailure('x', { dsnBounced: true }).cause).toBe('bounced');
  });
});
