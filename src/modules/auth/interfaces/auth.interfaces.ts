/**
 * JWT payload interface — embedded in both access and refresh tokens.
 * Keep minimal to reduce token size.
 */
export interface JwtPayload {
  /** User UUID */
  sub: string;
  /** User email */
  email: string;
  /** Server-side session version for immediate logout invalidation */
  sv: number;
}

/**
 * Token pair returned on login/register/refresh.
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authenticated user object attached to the request.
 * This is the shape available via @CurrentUser().
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionVersion?: number;
}
