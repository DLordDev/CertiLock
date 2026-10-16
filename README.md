# CertiLock security configuration

## Problem

Firebase web applications need a configuration object in browser code to connect
to the correct Firebase project. Its `apiKey`, project ID, and app ID are
identifiers, not private credentials. They are visible to anyone who can load
the site, so moving them into a frontend `.env` file would not make them secret:
browser-delivered values can still be inspected.

The credentials that must remain private are Firebase service-account keys,
private signing keys, and other server-side secrets. The project `.gitignore`
excludes common credential files, private-key formats, environment files, and
local Firebase state. No service-account or private-key file is required by the
current browser-only Firebase setup.

## Solution

- Keep the Firebase web configuration in the client so the app can initialize.
- Restrict the Firebase API key in Google Cloud/Firebase to the required APIs
  and, where practical, the deployed website's allowed referrers.
- Protect data with Firebase Authentication and restrictive Firestore Security
  Rules. The rules in `firestore.rules` require a signed-in user and constrain
  certificate reads and writes. They also permit only one owner-only certificate
  edit, keep the registration number and email immutable, and block later edits.
- Never put a service-account key or other server-side credential in browser
  code or commit it. If server-side access is added later, store credentials in
  a server-side secret manager or protected environment configuration.
- If a private credential is ever committed, removing it from the working tree
  is not enough: revoke or rotate it, then remove it from repository history as
  appropriate.

## Security algorithm

1. Identify what the value is used for. A Firebase web config identifies the
   project; service-account keys and private keys grant privileged access.
2. Keep the web config available to the browser, but apply API restrictions to
   its key. Do not rely on hiding it in frontend environment variables.
3. For every database operation, require authentication and authorize the
   specific user and data in Firestore Security Rules. Test rules before
   deployment.
4. Keep privileged credentials server-side, outside source control, and ignore
   their local credential files with `.gitignore`.
5. If a private credential may have been exposed, revoke or rotate it first;
   then clean up the repository and verify that the replacement is not tracked.
