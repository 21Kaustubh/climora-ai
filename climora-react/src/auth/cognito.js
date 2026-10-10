/** Amazon Cognito User Pool authentication, with no client secret in the browser.
 *  The UI works in guest mode if the two VITE_COGNITO_* settings are absent.
 */
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';

const userPoolId = (import.meta.env.VITE_COGNITO_USER_POOL_ID || '').trim();
const clientId = (import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '').trim();
export const authConfigured = Boolean(userPoolId && clientId);
let pool;

function getPool() {
  if (!authConfigured) throw new Error('Account sign-in is not yet configured. Continue as guest or set up AWS Cognito.');
  if (!pool) pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
  return pool;
}

function getUser(email) {
  return new CognitoUser({ Username: email.trim().toLowerCase(), Pool: getPool() });
}

function publicProfile(session, cognitoUser) {
  const payload = session.getIdToken().decodePayload();
  return {
    id: String(payload.sub || cognitoUser.getUsername()),
    email: String(payload.email || cognitoUser.getUsername()),
    displayName: String(payload.name || (payload.email || '').split('@')[0] || 'Climora explorer'),
    verified: payload.email_verified === true || payload.email_verified === 'true',
  };
}

export async function restoreSession() {
  if (!authConfigured) return null;
  const user = getPool().getCurrentUser();
  if (!user) return null;
  return new Promise(resolve => {
    user.getSession((err, session) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(publicProfile(session, user));
    });
  });
}

export function signIn(email, password) {
  const cognitoUser = getUser(email);
  const details = new AuthenticationDetails({ Username: email.trim().toLowerCase(), Password: password });
  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(details, {
      onSuccess: session => resolve(publicProfile(session, cognitoUser)),
      onFailure: reject,
      newPasswordRequired: () => reject(new Error('This account requires a password update. Contact the account administrator.')),
      mfaRequired: () => reject(new Error('This user pool requires MFA. Use the configured Cognito hosted login or disable MFA for this demo app.')),
      totpRequired: () => reject(new Error('This account requires an authenticator code, which this demo login does not support.')),
      selectMFAType: () => reject(new Error('This account requires MFA selection, which this demo login does not support.')),
      customChallenge: () => reject(new Error('This user pool requires an unsupported custom sign-in challenge.')),
    });
  });
}

export function signUp(email, password, displayName = '') {
  const attributes = [new CognitoUserAttribute({ Name: 'email', Value: email.trim().toLowerCase() })];
  if (displayName.trim()) attributes.push(new CognitoUserAttribute({ Name: 'name', Value: displayName.trim() }));
  return new Promise((resolve, reject) => {
    getPool().signUp(email.trim().toLowerCase(), password, attributes, null, (err, result) => {
      if (err) reject(err);
      else resolve({ confirmed: Boolean(result?.userConfirmed), username: result?.user?.getUsername() });
    });
  });
}

export function verifyEmail(email, code) {
  return new Promise((resolve, reject) => {
    getUser(email).confirmRegistration(code.trim(), true, (err, result) => err ? reject(err) : resolve(result));
  });
}

export function resendCode(email) {
  return new Promise((resolve, reject) => {
    getUser(email).resendConfirmationCode((err, result) => err ? reject(err) : resolve(result));
  });
}

export function requestPasswordReset(email) {
  return new Promise((resolve, reject) => {
    getUser(email).forgotPassword({
      onSuccess: resolve,
      inputVerificationCode: resolve,
      onFailure: reject,
    });
  });
}

export function confirmPasswordReset(email, code, password) {
  return new Promise((resolve, reject) => {
    getUser(email).confirmPassword(code.trim(), password, { onSuccess: resolve, onFailure: reject });
  });
}

export function signOut() {
  if (!authConfigured) return;
  getPool().getCurrentUser()?.signOut();
}

export function friendlyAuthError(err) {
  if (err?.code === 'UserNotConfirmedException') return 'Please verify your email with the confirmation code before signing in.';
  if (err?.code === 'UsernameExistsException') return 'An account with this email already exists. Try signing in.';
  if (err?.code === 'NotAuthorizedException' || err?.code === 'UserNotFoundException') return 'Sign-in failed. Check your email and password.';
  if (err?.code === 'CodeMismatchException') return 'Incorrect verification code. Check your email and try again.';
  if (err?.code === 'ExpiredCodeException') return 'This code has expired. Request a new code.';
  if (err?.code === 'LimitExceededException' || err?.code === 'TooManyRequestsException') return 'Too many attempts. Please wait before trying again.';
  return err?.message || 'Unable to complete this request. Try again.';
}
