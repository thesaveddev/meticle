import jwt from 'jsonwebtoken';
import { UserRole } from '@meticle/shared';

interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRATION as any) || '15m',
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRATION as any) || '7d',
  });
};

export const generateMfaChallengeToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, mfaChallenge: true }, process.env.JWT_SECRET as string, {
    expiresIn: '5m',
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
};

export const verifyMfaChallengeToken = (token: string): TokenPayload & { mfaChallenge: boolean } => {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload & { mfaChallenge: boolean };
};
