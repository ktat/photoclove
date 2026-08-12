import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The Google Photos upload path reads its token from localForage and treats any
 * record it finds as valid. So what happens to that record when a sign-in fails
 * to write it decides which account the next upload goes to.
 */

const invoke = vi.fn();
const setItem = vi.fn();
const removeItem = vi.fn();

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args) => invoke(...args) }));
vi.mock('../.google-auth-config', () => ({ GoogleAuthConfig: { clientId: 'test-client-id' } }));
vi.mock('../storage/forage', () => ({
    localForage: {
        setItem: (...args) => setItem(...args),
        removeItem: (...args) => removeItem(...args),
    },
}));

const { googleSignIn } = await import('../services/GoogleAuthService.js');

/** The redirect URL the OAuth proxy sends back, with tokens in the `res` param. */
function redirectUrl(tokens) {
    return `http://localhost:8000/?res=${encodeURIComponent(JSON.stringify(tokens))}`;
}

describe('google sign-in token storage', () => {
    beforeEach(() => {
        invoke.mockReset().mockResolvedValue(undefined);
        setItem.mockReset().mockResolvedValue(undefined);
        removeItem.mockReset().mockResolvedValue(undefined);
    });

    it('stores the tokens where the upload path reads them', async () => {
        await googleSignIn(redirectUrl({ access_token: 'a', refresh_token: 'r' }));

        expect(setItem).toHaveBeenCalledWith('GoogleOAuthTokens', {
            accessToken: 'a',
            refreshToken: 'r',
        });
        expect(removeItem).not.toHaveBeenCalled();
    });

    it('clears the previous account\'s tokens when the write fails', async () => {
        setItem.mockRejectedValue(new Error('storage unavailable'));

        await googleSignIn(redirectUrl({ access_token: 'a', refresh_token: 'r' }));

        // Without this the record from an earlier sign-in survives, and the
        // next upload goes to that account instead of failing.
        expect(removeItem).toHaveBeenCalledWith('GoogleOAuthTokens');
    });

    it('does not store anything when no access token comes back', async () => {
        await googleSignIn(redirectUrl({ refresh_token: 'r' }));

        expect(setItem).not.toHaveBeenCalled();
        expect(invoke).not.toHaveBeenCalled();
    });
});
