/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_API_PROXY_TARGET?: string;
  readonly VITE_PUBLIC_BASE_PATH?: string;

  /**
   * Which sign-in methods the login page exposes: `basic`, `cognito`, or `both`.
   * Must align with the API's AUTH_MODE when using Basic auth.
   */
  readonly VITE_AUTH_MODE?: string;

  // Cognito hosted-UI PKCE flow. Required when VITE_AUTH_MODE is `cognito` or `both`.
  readonly VITE_COGNITO_DOMAIN?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_REDIRECT_URI?: string;
  readonly VITE_COGNITO_LOGOUT_URI?: string;
  /** Space-separated OAuth scopes (default `openid email profile`). */
  readonly VITE_COGNITO_SCOPES?: string;
  /** Skip the hosted-UI IdP picker and go straight to the named SAML IdP. */
  readonly VITE_COGNITO_IDP_IDENTIFIER?: string;

  // Claim value that promotes a signed-in user to admin in the SPA. MUST
  // match the Lambda's ADMIN_ROLE_CLAIM_VALUE - mismatched values let the
  // admin UI offer writes the API then rejects with 403. Defaults to "admin".
  readonly VITE_ADMIN_ROLE_CLAIM_VALUE?: string;
  // Claim value that grants Applications-only management access in the SPA.
  // MUST match the Lambda's APP_EDIT_ROLE_CLAIM_VALUE for the same reason.
  // Defaults to "app-edit".
  readonly VITE_APP_EDIT_ROLE_CLAIM_VALUE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
