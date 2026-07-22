import { db } from "@/DB/drizzle";
import { accounts, sessions, users, verificationTokens } from "@/DB/schema";
import { isAdminRole } from "@/lib/rbac";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import { customFetch } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/microsoft-entra-id";
import { randomUUID } from "node:crypto";

const isAuthDebug = process.env.AUTH_DEBUG === "true";
const authSecrets = [
  process.env.AUTH_SECRET?.trim(),
  process.env.NEXTAUTH_SECRET?.trim(),
].filter(
  (value, index, source): value is string =>
    Boolean(value) && source.indexOf(value) === index,
);

if (authSecrets.length === 0) {
  console.error(
    "[auth] Missing AUTH_SECRET/NEXTAUTH_SECRET. JWT sessions will fail without a stable secret.",
  );
}

if (authSecrets.length > 1) {
  console.warn(
    "[auth] Multiple auth secrets detected; enabling JWT secret rotation support.",
  );
}

const resolvedAuthSecret: string | string[] | undefined =
  authSecrets.length > 1 ? authSecrets : authSecrets[0];

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const authFetchRetries = parseNonNegativeInt(process.env.AUTH_FETCH_RETRIES, 2);
const authFetchRetryDelayMs = parseNonNegativeInt(
  process.env.AUTH_FETCH_RETRY_DELAY_MS,
  400,
);
const authFetchRetryMaxDelayMs = parseNonNegativeInt(
  process.env.AUTH_FETCH_RETRY_MAX_DELAY_MS,
  2000,
);
const authAdapterRetries = parseNonNegativeInt(
  process.env.AUTH_ADAPTER_RETRIES,
  2,
);
const authAdapterRetryDelayMs = parseNonNegativeInt(
  process.env.AUTH_ADAPTER_RETRY_DELAY_MS,
  250,
);
const authAdapterRetryMaxDelayMs = parseNonNegativeInt(
  process.env.AUTH_ADAPTER_RETRY_MAX_DELAY_MS,
  1500,
);

const DEFAULT_DEVADMIN_WHITELIST_EMAILS = [
  "kkaila@itbd.net",
  "sunny.kaila@itbd.net",
  "rkaila@itbd.net",
  "rhayre@itbd.net",
  "pryce.singh@itbd.net",
  "preston.choudhary@itbd.net",
  "gagan.sandhu@itbd.net",
  "ssaini@itbd.net",
  "jkhan@itbd.net",
];

const DEFAULT_EXECUTIVE_WHITELIST_EMAILS = [
  "Lee.Cavellier@itbd.net",
  "Amit.Dubey@itbd.net",
  "GKaur@itbd.net",
  "anamika.rathore@itbd.net",
  "Andrea.Canlas@itbd.net",
  "Banmeet.Kour@itbd.net",
  "PritamK@itbd.net",
  "Suhrid.Rana@itbd.net",
  "kpatel@itbd.net",
  "vikram.kanitkar@itbd.net",
  "ankur.kumar@itbd.net",
  "manu.sharma@itbd.net",
  "suhrid.rana@itbd.net",
  "Natalie.McKenzie@itbd.net",
  "Akshay.Julka@itbd.net",
];

const normalizeEmail = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

const parseEmailList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0);

const devAdminWhitelistEmails = new Set([
  ...DEFAULT_DEVADMIN_WHITELIST_EMAILS.map((email) => normalizeEmail(email)),
  ...parseEmailList(process.env.DEVADMIN_WHITELIST_EMAILS),
]);

const isWhitelistedDevAdminEmail = (email: string | null | undefined) =>
  devAdminWhitelistEmails.has(normalizeEmail(email));

const executiveWhitelistEmails = new Set([
  ...DEFAULT_EXECUTIVE_WHITELIST_EMAILS.map((email) => normalizeEmail(email)),
  ...parseEmailList(process.env.EXECUTIVE_WHITELIST_EMAILS),
]);

const isWhitelistedExecutiveEmail = (email: string | null | undefined) =>
  executiveWhitelistEmails.has(normalizeEmail(email));

type EntraProfileLike = {
  sub?: string;
  oid?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
};

const pickFirstNonEmpty = (...values: Array<string | undefined>) => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
};

const resolveEntraEmail = (profile: EntraProfileLike) => {
  const explicitEmail = pickFirstNonEmpty(
    profile.email,
    profile.preferred_username,
    profile.upn,
  );

  if (explicitEmail && explicitEmail.includes("@")) {
    return explicitEmail.toLowerCase();
  }

  const normalizedUser = explicitEmail
    ?.toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-");
  if (normalizedUser) {
    return `${normalizedUser}@entra.local`;
  }

  const stableIdentifier = pickFirstNonEmpty(
    profile.oid,
    profile.sub,
  )?.toLowerCase();
  if (stableIdentifier) {
    return `${stableIdentifier}@entra.local`;
  }

  return `entra-${randomUUID()}@entra.local`;
};

const resolveEntraUserId = (profile: EntraProfileLike) =>
  pickFirstNonEmpty(
    profile.sub,
    profile.oid,
    profile.preferred_username,
    profile.email,
  ) ?? randomUUID();

const isRetryableAuthFetchError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: string;
    name?: string;
    message?: string;
    cause?: {
      code?: string;
      name?: string;
      message?: string;
    };
  };

  const code = candidate.code ?? candidate.cause?.code;
  const name = candidate.name ?? candidate.cause?.name;
  const message = `${candidate.message ?? ""} ${candidate.cause?.message ?? ""}`;

  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT"
  ) {
    return true;
  }

  if (name === "ConnectTimeoutError") {
    return true;
  }

  return /connect timeout|fetch failed|socket|reset/i.test(message);
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const extractErrorCodes = (error: unknown) => {
  const visited = new Set<object>();
  const queue: unknown[] = [error];
  const codes = new Set<string>();
  const messages: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const candidate = current as {
      code?: string;
      errno?: number;
      message?: string;
      cause?: unknown;
      err?: unknown;
    };

    if (candidate.code) {
      codes.add(candidate.code);
    }
    if (candidate.errno !== undefined) {
      codes.add(String(candidate.errno));
    }
    if (candidate.message) {
      messages.push(candidate.message);
    }
    if (candidate.cause) {
      queue.push(candidate.cause);
    }
    if (candidate.err) {
      queue.push(candidate.err);
    }
  }

  return {
    codes,
    message: messages.join(" "),
  };
};

const isRetryableAdapterError = (error: unknown) => {
  const { codes, message } = extractErrorCodes(error);

  if (
    codes.has("ECONNRESET") ||
    codes.has("ETIMEDOUT") ||
    codes.has("EPIPE") ||
    codes.has("PROTOCOL_CONNECTION_LOST")
  ) {
    return true;
  }

  return /econnreset|timed out|timeout|connection lost|socket hang up/i.test(
    message,
  );
};

const withRetryingAdapter = <T extends object>(adapter: T): T => {
  return new Proxy(adapter, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }

      return async (...args: unknown[]) => {
        for (let attempt = 0; ; attempt += 1) {
          try {
            return await Reflect.apply(value, target, args);
          } catch (error) {
            const shouldRetry =
              attempt < authAdapterRetries && isRetryableAdapterError(error);
            if (!shouldRetry) {
              throw error;
            }

            const delay = Math.min(
              authAdapterRetryDelayMs * 2 ** attempt,
              authAdapterRetryMaxDelayMs,
            );

            if (isAuthDebug) {
              console.warn(
                `[auth] Adapter method ${String(property)} failed; retrying in ${delay}ms (${attempt + 1}/${authAdapterRetries}).`,
              );
            }

            await wait(delay);
          }
        }
      };
    },
  });
};

const withRetryingAuthFetch = (
  providerId: string,
  baseFetch: typeof fetch,
): typeof fetch => {
  return async (...args: Parameters<typeof fetch>) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await baseFetch(...args);
      } catch (error) {
        const shouldRetry =
          attempt < authFetchRetries && isRetryableAuthFetchError(error);
        if (!shouldRetry) {
          throw error;
        }

        const delay = Math.min(
          authFetchRetryDelayMs * 2 ** attempt,
          authFetchRetryMaxDelayMs,
        );

        if (isAuthDebug) {
          const candidate = error as {
            code?: string;
            cause?: { code?: string };
          };
          const code = candidate.code ?? candidate.cause?.code ?? "UNKNOWN";
          console.warn(
            `[auth] ${providerId} fetch failed (${code}); retrying in ${delay}ms (${attempt + 1}/${authFetchRetries}).`,
          );
        }

        await wait(delay);
      }
    }
  };
};

// How often (ms) the jwt callback re-reads role/sessionVersion from the DB on
// subsequent requests. Lower = faster propagation of role changes, more DB
// load. Default 30s; override with AUTH_ROLE_REFRESH_INTERVAL_MS.
const ROLE_REFRESH_INTERVAL_MS = parseNonNegativeInt(
  process.env.AUTH_ROLE_REFRESH_INTERVAL_MS,
  30_000,
);

const shouldUseAdapter = process.env.AUTH_DISABLE_ADAPTER !== "true";
const authAdapter = shouldUseAdapter
  ? withRetryingAdapter(
      DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      }),
    )
  : undefined;

if (!shouldUseAdapter) {
  console.warn(
    "[auth] AUTH_DISABLE_ADAPTER=true, running without DB adapter for OAuth persistence.",
  );
}

// Extend the Session and User types to include 'role'
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    sessionVersion?: number;
  }
}

// Shape of the extra fields we store on the JWT. We augment the token via a
// local cast instead of `declare module "next-auth/jwt"` because that module
// is not resolvable to augment in this NextAuth v5 (beta) setup.
type AppToken = {
  id?: string;
  sub?: string;
  role?: string;
  sessionVersion?: number;
  lastChecked?: number;
  invalidated?: boolean;
};

export const authConfig = {
  // NextAuth v5 commonly requires this in dev / proxied deployments.
  // Prefer setting AUTH_URL/NEXTAUTH_URL correctly in production.
  trustHost: true,
  // Keep debug opt-in (logs can contain sensitive details)
  debug: isAuthDebug,
  // Support both v5 and v4-style env vars, including rotation after secret changes.
  secret: resolvedAuthSecret,
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  adapter: authAdapter,
  logger: {
    error(code, ...message) {
      console.error("[auth][error]", code, ...message);
    },
    warn(code) {
      console.warn("[auth][warn]", code);
    },
    debug(code, ...message) {
      if (isAuthDebug) {
        console.debug("[auth][debug]", code, ...message);
      }
    },
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
    async signIn({ user }) {
      const assignedRole = isWhitelistedDevAdminEmail(user.email)
        ? "devAdmin"
        : isWhitelistedExecutiveEmail(user.email)
          ? "executive"
          : null;

      if (!assignedRole) {
        return true;
      }

      user.role = assignedRole;

      try {
        if (user.id) {
          await db
            .update(users)
            .set({ role: assignedRole })
            .where(eq(users.id, user.id));
        } else {
          const normalizedEmail = normalizeEmail(user.email);
          if (normalizedEmail) {
            await db
              .update(users)
              .set({ role: assignedRole })
              .where(eq(users.email, normalizedEmail));
          }
        }
      } catch (error) {
        console.error(
          `[auth] Failed to persist ${assignedRole} role for whitelisted email:`,
          error,
        );
      }

      return true;
    },
    async jwt({ token, user, account }) {
      const t = token as AppToken;
      // FIRST login only
      if (user) {
        t.id =
          user.id ?? (typeof t.sub === "string" ? t.sub : (t.id as string));
        t.role = isWhitelistedDevAdminEmail(user.email)
          ? "devAdmin"
          : isWhitelistedExecutiveEmail(user.email)
            ? "executive"
            : (user.role ?? (t.role as string) ?? "user");
        // Seed the session version + refresh marker so subsequent requests can
        // detect role changes / forced logouts without a DB hit every time.
        t.sessionVersion =
          typeof user.sessionVersion === "number" ? user.sessionVersion : 0;
        t.lastChecked = Date.now();
        if (isAuthDebug) {
          console.log("JWT callback - user logged in:", {
            id: t.id,
            role: t.role,
            sessionVersion: t.sessionVersion,
          });
        }
      } else if (shouldUseAdapter) {
        // SUBSEQUENT requests: keep the token's role in sync with the DB and
        // honour forced logouts, throttled so we don't query on every request.
        const lastChecked =
          typeof t.lastChecked === "number" ? t.lastChecked : 0;
        const userId =
          (t.id as string | undefined) ??
          (typeof t.sub === "string" ? t.sub : undefined);

        if (userId && Date.now() - lastChecked >= ROLE_REFRESH_INTERVAL_MS) {
          try {
            const rows = await db
              .select({
                role: users.role,
                sessionVersion: users.sessionVersion,
              })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1);

            const fresh = rows[0];

            if (!fresh) {
              // User no longer exists — invalidate the session.
              t.invalidated = true;
            } else if (
              typeof t.sessionVersion === "number" &&
              fresh.sessionVersion !== t.sessionVersion
            ) {
              // Admin bumped sessionVersion → force this user to log in again.
              t.invalidated = true;
              if (isAuthDebug) {
                console.log("[auth] Session version mismatch, forcing logout", {
                  userId,
                  tokenVersion: t.sessionVersion,
                  dbVersion: fresh.sessionVersion,
                });
              }
            } else {
              // Live-refresh the role so proxy + sidebar see changes without
              // requiring a logout/login round-trip.
              if (fresh.role && fresh.role !== t.role) {
                if (isAuthDebug) {
                  console.log("[auth] Refreshing role from DB", {
                    userId,
                    from: t.role,
                    to: fresh.role,
                  });
                }
                t.role = fresh.role;
              }
              t.lastChecked = Date.now();
            }
          } catch (error) {
            // On DB error keep the existing token rather than locking the user
            // out; we'll retry on the next request after the interval.
            console.error("[auth] Failed to refresh role from DB:", error);
          }
        }
      }

      // OAuth access/refresh tokens are persisted in the `accounts` table by the adapter.
      // Keeping them out of the session JWT prevents oversized cookies and decode failures.
      if (account?.provider === "microsoft-entra-id" && isAuthDebug) {
        console.debug(
          "[auth][debug] Microsoft account tokens stored via adapter",
        );
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as AppToken;
      // A bumped sessionVersion / deleted user invalidates the token. Strip the
      // user so the proxy treats this as unauthenticated and redirects to login.
      if (t.invalidated) {
        return { ...session, user: undefined } as unknown as typeof session;
      }

      // With a DB adapter, NextAuth provides `user` here.
      // Expose it on the session for easy access in the app.
      if (session.user) {
        const tokenId =
          (t.id as string | undefined) ??
          (typeof t.sub === "string" ? t.sub : undefined);
        (session.user as { id?: string }).id = tokenId;
        session.user.role = (t.role as string) ?? "user";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allow relative callback URLs and absolute URLs on the same origin;
      // block everything else.
      if (url.startsWith("/")) {
        return new URL(url, baseUrl).toString();
      }

      if (url.startsWith(baseUrl)) {
        return url;
      }

      return baseUrl;
    },
  },
  events: {},
  providers: (() => {
    const microsoftEntraProvider = AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope:
            process.env.AZURE_AD_GRAPH_SCOPES ??
            "openid profile email offline_access User.Read",
          prompt: process.env.AZURE_AD_PROMPT ?? "consent",
        },
      },
      issuer:
        (process.env.AZURE_AD_TENANT_ID
          ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
          : undefined) ?? (process.env.AZURE_AD_AUTHORITY as string),
      profile(profile) {
        const entraProfile = profile as EntraProfileLike;
        const email = resolveEntraEmail(entraProfile);

        if (isAuthDebug && !entraProfile.email) {
          console.warn(
            "[auth] Microsoft Entra profile missing email claim; using fallback identifier.",
          );
        }

        return {
          id: resolveEntraUserId(entraProfile),
          name:
            pickFirstNonEmpty(
              entraProfile.name,
              entraProfile.preferred_username,
              email,
            ) ?? "Microsoft User",
          email,
          image: null,
        };
      },
    });

    microsoftEntraProvider[customFetch] = withRetryingAuthFetch(
      "microsoft-entra-id",
      microsoftEntraProvider[customFetch] ?? fetch,
    );

    // Break-glass credential login. This is an admin bypass for when SSO is
    // unavailable — it authenticates ONLY users who already have a bcrypt
    // password hash stored on their `users` row (seeded deliberately via the
    // admin bootstrap script). SSO-only users have `password = NULL` and can
    // never be logged into through this path, so it can't be used to
    // impersonate arbitrary accounts. Roles are still resolved by the jwt
    // callback below (whitelist-driven), so this grants no extra privilege
    // beyond what the same email gets over SSO.
    const credentialsProvider = CredentialsProvider({
      id: "credentials",
      name: "Admin credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = normalizeEmail(
          typeof credentials?.username === "string" ? credentials.username : "",
        );
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!identifier || !password) {
          return null;
        }

        try {
          // Match on email OR username, but only rows that actually have a
          // stored hash. `.limit(1)` — email is unique, username is not
          // guaranteed to be, so prefer the email match implicitly by ordering.
          const rows = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              role: users.role,
              password: users.password,
              sessionVersion: users.sessionVersion,
            })
            .from(users)
            .where(eq(users.email, identifier))
            .limit(1);

          const account = rows[0];
          if (!account || !account.password) {
            // No such user, or user has no credential login provisioned.
            return null;
          }

          // ADMIN-ONLY: credential login is a break-glass path reserved for
          // admins. Non-admins must use SSO — reject them even if a password
          // hash somehow exists on their row. `ADMIN_ROLES` in lib/rbac.ts is
          // the single source of truth for who counts as an admin.
          if (!isAdminRole(account.role)) {
            return null;
          }

          const ok = await compare(password, account.password);
          if (!ok) {
            return null;
          }

          return {
            id: account.id,
            name: account.name ?? undefined,
            email: account.email,
            role: account.role,
            sessionVersion: account.sessionVersion,
          };
        } catch (error) {
          console.error("[auth] Credentials authorize failed:", error);
          return null;
        }
      },
    });

    return [microsoftEntraProvider, credentialsProvider];
  })(),
} satisfies NextAuthConfig;
