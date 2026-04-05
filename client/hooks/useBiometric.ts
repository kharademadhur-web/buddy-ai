import { useState, useCallback } from "react";

interface BiometricRegistrationOptions {
  userId: string;
  userName: string;
  userEmail?: string;
  deviceId: string;
}

interface BiometricAuthenticationOptions {
  userId: string;
  deviceId: string;
}

interface BiometricResult {
  credential: string;
  success: boolean;
  error?: string;
}

interface UseBiometricReturn {
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  registerBiometric: (options: BiometricRegistrationOptions) => Promise<BiometricResult>;
  authenticateWithBiometric: (
    options: BiometricAuthenticationOptions
  ) => Promise<BiometricResult>;
  isSupportedDevice: () => boolean;
}

/**
 * Hook for WebAuthn/Biometric authentication
 * Supports fingerprint, face recognition, and platform authenticators
 */
export function useBiometric(): UseBiometricReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if WebAuthn is available
  const isAvailable =
    typeof window !== "undefined" &&
    !!(window.PublicKeyCredential ||
      (navigator.credentials && navigator.credentials.create));

  /**
   * Check if device supports WebAuthn
   */
  const isSupportedDevice = useCallback((): boolean => {
    if (!isAvailable) return false;

    // Check for platform authenticator availability
    if (window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      return true;
    }

    return false;
  }, [isAvailable]);

  /**
   * Register biometric credential
   */
  const registerBiometric = useCallback(
    async (options: BiometricRegistrationOptions): Promise<BiometricResult> => {
      setIsLoading(true);
      setError(null);

      try {
        if (!isAvailable) {
          throw new Error("Biometric authentication is not available on this device");
        }

        if (typeof window === "undefined") {
          throw new Error("This feature is only available in the browser");
        }

        // Generate challenge (random bytes)
        const challenge = crypto.getRandomValues(new Uint8Array(32));

        // Some DOM lib versions don't type all WebAuthn fields consistently.
        const credentialCreationOptions: CredentialCreationOptions = {
          publicKey: {
            challenge,
            rp: {
              name: "Clinic SaaS",
            },
            user: {
              id: new TextEncoder().encode(options.userId),
              name: options.userName,
              displayName: options.userEmail || options.userName,
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" }, // ES256
              { alg: -257, type: "public-key" }, // RS256
            ],
            timeout: 60000, // 60 seconds
            attestation: "direct",
            // @ts-expect-error - not present in older lib.dom.d.ts
            userVerification: "preferred",
          },
        };

        // Create credential
        const credential = (await navigator.credentials?.create?.(
          credentialCreationOptions
        )) as PublicKeyCredential | null;

        if (!credential) {
          throw new Error("Failed to create credential");
        }

        // Serialize credential for storage/transmission
        const credentialString = JSON.stringify({
          id: credential.id,
          type: credential.type,
          rawId: Array.from(new Uint8Array(credential.rawId)),
          response: {
            clientDataJSON: Array.from(
              new Uint8Array(
                (credential.response as AuthenticatorAttestationResponse)
                  .clientDataJSON
              )
            ),
            attestationObject: Array.from(
              new Uint8Array(
                (credential.response as AuthenticatorAttestationResponse)
                  .attestationObject
              )
            ),
          },
        });

        setIsLoading(false);
        return {
          credential: credentialString,
          success: true,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Biometric registration failed";
        setError(errorMessage);
        setIsLoading(false);
        return {
          credential: "",
          success: false,
          error: errorMessage,
        };
      }
    },
    [isAvailable]
  );

  /**
   * Authenticate with biometric
   */
  const authenticateWithBiometric = useCallback(
    async (
      options: BiometricAuthenticationOptions
    ): Promise<BiometricResult> => {
      setIsLoading(true);
      setError(null);

      try {
        if (!isAvailable) {
          throw new Error("Biometric authentication is not available on this device");
        }

        if (typeof window === "undefined") {
          throw new Error("This feature is only available in the browser");
        }

        // Generate challenge
        const challenge = crypto.getRandomValues(new Uint8Array(32));

        const credentialRequestOptions: CredentialRequestOptions = {
          publicKey: {
            challenge,
            timeout: 60000, // 60 seconds
            userVerification: "preferred",
          },
        };

        // Get credential
        const assertion = (await navigator.credentials?.get?.(
          credentialRequestOptions
        )) as PublicKeyCredential | null;

        if (!assertion) {
          throw new Error("Failed to authenticate with biometric");
        }

        // Serialize assertion for verification
        const assertionString = JSON.stringify({
          id: assertion.id,
          type: assertion.type,
          rawId: Array.from(new Uint8Array(assertion.rawId)),
          response: {
            clientDataJSON: Array.from(
              new Uint8Array(
                (assertion.response as AuthenticatorAssertionResponse)
                  .clientDataJSON
              )
            ),
            authenticatorData: Array.from(
              new Uint8Array(
                (assertion.response as AuthenticatorAssertionResponse)
                  .authenticatorData
              )
            ),
            signature: Array.from(
              new Uint8Array(
                (assertion.response as AuthenticatorAssertionResponse).signature
              )
            ),
            userHandle: (assertion.response as AuthenticatorAssertionResponse)
              .userHandle
              ? Array.from(
                  new Uint8Array(
                    (assertion.response as AuthenticatorAssertionResponse)
                      .userHandle!
                  )
                )
              : null,
          },
        });

        setIsLoading(false);
        return {
          credential: assertionString,
          success: true,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Biometric authentication failed";
        setError(errorMessage);
        setIsLoading(false);
        return {
          credential: "",
          success: false,
          error: errorMessage,
        };
      }
    },
    [isAvailable]
  );

  return {
    isAvailable,
    isLoading,
    error,
    registerBiometric,
    authenticateWithBiometric,
    isSupportedDevice,
  };
}
