# Climora AI — Optional Login, Signup & My Trips (AWS Cognito)

## WHAT THIS UPDATE DOES
- Keeps **all existing** Google Maps, AWS/OpenRouteService routes, travel modes, GPS navigation, modeled pollution, current AQI/weather, Smart Departure Advisor and animations.
- Adds optional Cognito email sign-up, verification code, sign-in, logout, password reset, account dashboard and saved journeys.
- Guests can browse, plan journeys and save trips on **this browser only** without an account.
- Signed-in user's saved journeys are separated by Cognito `sub` on this device. They are **not synchronized across devices**, encrypted, backed up, or protected from a person with access to your computer. Database-backed cloud saving is NOT implemented.
- Google Sign-In is **not** included. Nearby Friends is **not** implemented and remains Upcoming.

## PART A — BACKUP / INSTALL
1. Back up `C:\Users\daksh\Downloads\1project\climora-react` first.
2. Use the `Climora_Auth_Dashboard_SRC.zip` archive to replace its `src` folder **and** `package.json`. Keep `.env.local`, `node_modules`, `.git`, any local changes and AWS backend untouched. (Alternatively use the FULL ZIP as a separate React project.)
3. In VS Code Terminal:
   ```powershell
   cd C:\Users\daksh\Downloads\1project\climora-react
   npm install
   npm run dev
   ```
4. Open `http://127.0.0.1:5500/` (NOT `/public/index.html`).
5. **Before Cognito setup**, you can test Guest Mode, My Trips and Save this journey. Clicking Sign in will show a clear Cognito setup message.

## PART B — AWS COGNITO SETUP (NO AWS LAMBDA CODE CHANGES)
1. Open https://console.aws.amazon.com/cognito/ and switch to AWS region **ap-south-1 (Mumbai)** (or your chosen region; the pool ID itself carries the region).
2. **User pools → Create user pool**. Name it e.g. `climora-users`.
3. Set sign-in identifier to **Email**. Enable **self-service sign-up** so visitors can create an account. Set email verification to **send verification code automatically**. Prefer required attribute **Email** only; `name` can be optional. Choose a sensible password policy.
4. For your initial demo select password sign-in and **no mandatory MFA**; the included custom React form implements Cognito SRP email/password login but **does not implement MFA / passkeys**. Enable suitable protections for production.
5. Create an app client with application type **Single-page application (SPA)** / **Public client**. **No client secret**. In its authentication flow settings ensure **ALLOW_USER_SRP_AUTH** is enabled. Do not copy or generate a client secret in this frontend.
6. If the console asks for a callback URL, choose `http://localhost:5500/` for local development. This SDK-based custom form uses Cognito User Pool APIs, not Hosted UI/OAuth redirects, so the callback is not used for this flow. Some console screens may require one to create an app client.
7. Copy the **User pool ID** (looks like `ap-south-1_XXXXXXXXX`) and **App client ID** (long random identifier). These IDs are public configuration, *not secrets*.
8. In the existing project root `climora-react/.env.local`, ADD these two lines below your working Google Maps settings:
   ```env
   VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
   VITE_COGNITO_APP_CLIENT_ID=YOUR_PUBLIC_SPA_CLIENT_ID
   ```
   Do not overwrite your current `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID`, or `VITE_CLIMORA_API_URL`.
9. Stop Vite (`Ctrl + C`) and restart with `npm run dev` to reload env settings.
10. Click **Sign in → Create account**. Provide a real email and password meeting the pool's password policy. Check your mailbox for the Cognito code. Verify, sign in, and try My Trips.

Important: Your Cognito account configuration may require additional AWS-side email/SMS settings or impose messaging quotas. Look at CloudWatch/Cognito console if delivery fails. AWS usage may incur charges; review billing and set budget alerts. No OAuth consent screen is required for direct User Pool SDK authentication.

## PART C — FUNCTIONAL TEST CHECKLIST
[ ] Guest can use Google Maps and Calculate routes with no login.
[ ] Header has Sign in and My trips (mobile: hamburger menu).
[ ] Calculate Bandra -> Juhu; on the selected route click '☆ Save this journey'.
[ ] Open My trips: saved journey appears; 'Plan again' refills start/end/mode, then Calculate routes fetches fresh data.
[ ] Saved trip Remove works.
[ ] Without Cognito settings, Sign in shows a setup message but planner still works.
[ ] With Cognito settings: sign up, confirm code, sign in, sign out and reset password.
[ ] Account A's local trips aren't displayed in Account B's dashboard.
[ ] Google Maps/Satellite, GPS, weather, Smart Departure Advisor, route pollution comparison unchanged.

## TROUBLESHOOTING
- `Could not resolve amazon-cognito-identity-js`: From `climora-react`, run `npm install` and `npm run dev`.
- Sign in says not configured: verify the TWO `VITE_COGNITO_*` names in `climora-react/.env.local`; restart Vite.
- `SecretHash does not match` / client secret error: You created a confidential app client; create a NEW SPA/public client **without secret** and update its app client ID.
- `USER_SRP_AUTH not enabled`: In Cognito User Pool app client enable **SRP** flow.
- `User not confirmed`: complete email verification or resend confirmation code.
- No verification email: check spam, user pool verification settings and any SES/email restrictions.
- `npm install` problems: check your internet connection, Node.js LTS and that you run the command from the React folder containing `package.json`.
- Unexpected authentication challenge: your pool requires MFA, passkey, or another flow; custom demo form does not support those challenges yet. Don't disable required security in production—choose Cognito's hosted login or implement the necessary challenge securely.
- Google Maps key: keep existing `VITE_GOOGLE_MAPS_API_KEY`, with website/API restrictions. Do not paste private tokens or passwords in chat/GitHub.
- AWS API Gateway: its public route endpoint is unchanged; adding Cognito does not automatically secure the routing API.

## SECURITY AND LIMITATIONS
- AWS Cognito authenticates email/password. Passwords are never stored in Climora's trip storage. The Cognito SDK manages local browser tokens; protect the deployed site against XSS and use HTTPS in production.
- `VITE_` variables are embedded in frontend bundles. **Never** put AWS IAM credentials, secret keys, app-client secrets or server tokens there. User Pool ID and public app-client ID are allowed.
- Saved trips are **localStorage only**. They are NOT cloud-synced or secured by Cognito authorization, and may remain on the browser after sign out. Do not save sensitive routes on a shared device.
- For real, secure, cross-device trips later: DynamoDB + Cognito JWT-authorized API Gateway + Lambda with per-user authorization and delete/export controls.
- Google Sign-In, MFA, cloud backup, Nearby Friends not implemented.
- Production should include access control, monitoring, abuse protection, deletion and appropriate privacy notice before serving real users.
- GitHub: `.env.local`, `node_modules` and build artifacts are ignored by the included `.gitignore`; verify `git status` before pushing.
