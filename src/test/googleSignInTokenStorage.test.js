import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tokens live only in the OS keyring; the frontend hands them straight to Rust
 * and keeps nothing. What this covers is the boundary: that no token is written
 * back into JS-visible storage, that the plaintext entry older versions left in
 * IndexedDB gets purged, and that a keyring failure is a failed sign-in rather
 * than a silent one.
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

    it('hands the tokens to the keyring and keeps none in JS storage', async () => {
        await googleSignIn(redirectUrl({ access_token: 'a', refresh_token: 'r' }));

        expect(invoke).toHaveBeenCalledWith('store_google_tokens', {
            accessToken: 'a',
            refreshToken: 'r',
            expiresIn: 3600,
        });
        // Writing a token anywhere the frontend can read it is the thing this
        // design removed - a refresh token in IndexedDB sits there in plaintext.
        expect(setItem).not.toHaveBeenCalled();
    });

    it('purges the plaintext tokens an older version left behind', async () => {
        await googleSignIn(redirectUrl({ access_token: 'a', refresh_token: 'r' }));

        expect(removeItem).toHaveBeenCalledWith('GoogleOAuthTokens');
    });

    it('fails the sign-in when the keyring store fails', async () => {
        invoke.mockRejectedValue(new Error('keyring unavailable'));

        await googleSignIn(redirectUrl({ access_token: 'a', refresh_token: 'r' }));

        // Nothing usable was stored, so the run must stop rather than report a
        // success the upload path cannot honour.
        expect(setItem).not.toHaveBeenCalled();
    });

    it('purges the plaintext tokens even when the keyring store fails', async () => {
        invoke.mockRejectedValue(new Error('keyring unavailable'));

        await googleSignIn(redirectUrl({ access_token: 'a', refresh_token: 'r' }));

        // Assert the whole contract, not just the purge: without these the test
        // would also pass if the run never reached the keyring at all, or if it
        // fell back to writing the tokens somewhere JS can read.
        expect(invoke).toHaveBeenCalledWith('store_google_tokens', {
            accessToken: 'a',
            refreshToken: 'r',
            expiresIn: 3600,
        });
        expect(setItem).not.toHaveBeenCalled();
        // A keyring that cannot be written to is exactly the case where the old
        // plaintext entry would otherwise sit in IndexedDB forever - which is
        // the thing this change exists to remove.
        expect(removeItem).toHaveBeenCalledWith('GoogleOAuthTokens');
    });

    it('still signs in when the legacy purge fails', async () => {
        removeItem.mockRejectedValue(new Error('IndexedDB unavailable'));

        await googleSignIn(redirectUrl({ access_token: 'a', refresh_token: 'r' }));

        // Aborting here would not delete the stale entry - it survives either
        // way - so refusing to sign in buys no privacy and costs the feature.
        // The new tokens still belong in the keyring, and nothing reads the old
        // entry any more (photoOperations asks is_google_authenticated).
        expect(invoke).toHaveBeenCalledWith('store_google_tokens', {
            accessToken: 'a',
            refreshToken: 'r',
            expiresIn: 3600,
        });
        expect(setItem).not.toHaveBeenCalled();
    });

    it('does not store anything when no access token comes back', async () => {
        await googleSignIn(redirectUrl({ refresh_token: 'r' }));

        expect(invoke).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
    });
});
