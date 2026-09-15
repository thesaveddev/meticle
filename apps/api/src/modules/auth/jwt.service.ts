import jwt from 'jsonwebtoken';
import { UserRole } from '@meticle/shared';

interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

export type MfaChallengePurpose = 'login' | 'setup';

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, tokenType: 'access' }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRATION as any) || '15m',
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRATION as any) || '7d',
  });
};

export const generateMfaChallengeToken = (payload: TokenPayload, purpose: MfaChallengePurpose): string => {
  return jwt.sign({ ...payload, tokenType: 'mfa-challenge', mfaChallenge: true, mfaChallengePurpose: purpose }, process.env.JWT_SECRET as string, {
    expiresIn: '5m',
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload & { tokenType?: string };
  if (payload.tokenType !== 'access') throw new Error('Invalid access token type');
  return payload;
};

export const verifyRefreshToken = (token: string): TokenPayload & { exp?: number } => {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload & { tokenType?: string; exp?: number };
  if (payload.tokenType !== 'refresh') throw new Error('Invalid refresh token type');
  return payload;
};

export const verifyMfaChallengeToken = (token: string, purpose?: MfaChallengePurpose): TokenPayload & { tokenType: 'mfa-challenge'; mfaChallenge: boolean; mfaChallengePurpose?: MfaChallengePurpose } => {
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload & { tokenType?: string; mfaChallenge: boolean; mfaChallengePurpose?: MfaChallengePurpose };
  if (payload.tokenType !== 'mfa-challenge' || !payload.mfaChallenge || (purpose && payload.mfaChallengePurpose !== purpose)) {
    throw new Error('Invalid MFA challenge purpose');
  }
  return payload as TokenPayload & { tokenType: 'mfa-challenge'; mfaChallenge: boolean; mfaChallengePurpose?: MfaChallengePurpose };
};
