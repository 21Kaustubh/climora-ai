import { useEffect, useRef, useState } from 'react';
import {
  authConfigured, confirmPasswordReset, friendlyAuthError, requestPasswordReset,
  resendCode, signIn, signUp, verifyEmail,
} from '../auth/cognito.js';

const TITLES = {
  signin: ['Welcome back', 'Sign in to personalize your Climora experience.'],
  signup: ['Create your account', 'Explore freely, save journeys and return anytime.'],
  confirm: ['Verify your email', 'Enter the confirmation code sent by AWS Cognito.'],
  reset: ['Reset your password', 'We will send a password reset code to your email.'],
  resetConfirm: ['Choose a new password', 'Use the code from your email to recover your account.'],
};

export default function AuthModal({ open, onClose, onContinueGuest = onClose, onAuthenticated }) {
  const [step, setStep] = useState('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => firstRef.current?.focus(), 20);
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(timeout); document.removeEventListener('keydown', onKey); };
  }, [open, busy, onClose]);

  if (!open) return null;
  const switchStep = (value) => { setStep(value); setError(''); setMessage(''); setCode(''); setPassword(''); };
  const run = async (task) => {
    setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (err) {
      setError(friendlyAuthError(err));
      if (err?.code === 'UserNotConfirmedException') setStep('confirm');
    } finally { setBusy(false); }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!authConfigured) return;
    if (step === 'signin') return void run(async () => {
      const profile = await signIn(email, password);
      setPassword('');
      onAuthenticated(profile);
      onClose();
    });
    if (step === 'signup') return void run(async () => {
      const result = await signUp(email, password, name);
      setPassword('');
      if (result.confirmed) { setStep('signin'); setMessage('Account created. You can sign in now.'); }
      else { setStep('confirm'); setMessage('We sent a confirmation code to your email.'); }
    });
    if (step === 'confirm') return void run(async () => {
      await verifyEmail(email, code);
      setStep('signin'); setCode(''); setMessage('Email verified. Sign in to continue.');
    });
    if (step === 'reset') return void run(async () => {
      await requestPasswordReset(email);
      setStep('resetConfirm'); setMessage('Check your email for a password reset code.');
    });
    if (step === 'resetConfirm') return void run(async () => {
      await confirmPasswordReset(email, code, password);
      setStep('signin'); setCode(''); setPassword(''); setMessage('Password updated. Sign in with your new password.');
    });
  };

  return <div className="account-backdrop" onMouseDown={e=>{ if(e.target===e.currentTarget&&!busy)onClose(); }}>
    <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title" aria-describedby="account-desc">
      <div className="account-head"><span className="account-kicker">✦ CLIMORA MEMBERSHIP</span><button className="account-close" onClick={onClose} disabled={busy} aria-label="Close sign in">✕</button></div>
      <div className="account-symbol" aria-hidden="true">✧</div>
      <h2 id="account-title">{TITLES[step][0]}</h2>
      <p id="account-desc">{TITLES[step][1]}</p>
      {!authConfigured ? <div className="account-not-setup" role="status">
        <strong>Accounts are not configured yet.</strong><p>Guest mode is fully functional. To enable real sign-in, create a Cognito User Pool and add its ID and public app-client ID to <code>.env.local</code>. See <code>README_AUTH_SETUP_HINDI.md</code>.</p>
        <button type="button" className="account-primary" onClick={onContinueGuest}>Continue as guest →</button>
      </div> : <>
        {['signin','signup'].includes(step)&&<div className="account-tabs" role="group" aria-label="Choose account action"><button className={step==='signin'?'active':''} onClick={()=>switchStep('signin')} type="button">Sign in</button><button className={step==='signup'?'active':''} onClick={()=>switchStep('signup')} type="button">Create account</button></div>}
        <form onSubmit={submit} className="account-form">
          {step==='signup'&&<label>Display name <span>optional</span><input ref={firstRef} type="text" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" maxLength={80}/></label>}
          <label>Email address<input ref={step==='signup'?undefined:firstRef} type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" disabled={busy}/></label>
          {['confirm','resetConfirm'].includes(step)&&<label>Verification code<input type="text" autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={e=>setCode(e.target.value)} placeholder="Code from your email" disabled={busy}/></label>}
          {['signin','signup','resetConfirm'].includes(step)&&<label>{step==='resetConfirm'?'New password':'Password'}<input type="password" autoComplete={step==='signin'?'current-password':'new-password'} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder={step==='signin'?'Your password':'At least 8 characters'} disabled={busy}/></label>}
          {error&&<div className="account-error" role="alert">{error}</div>}
          {message&&<div className="account-message" role="status">{message}</div>}
          <button className="account-primary" type="submit" disabled={busy}>{busy?'Please wait…':{
            signin:'Sign in →',signup:'Create account →',confirm:'Verify email →',reset:'Send reset code →',resetConfirm:'Save new password →',
          }[step]}</button>
        </form>
        <div className="account-links">
          {step==='signin'&&<button type="button" onClick={()=>switchStep('reset')}>Forgot password?</button>}
          {step==='confirm'&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{await resendCode(email);setMessage('A new code has been sent.');})}>Resend code</button>}
          {!['signin','signup'].includes(step)&&<button type="button" onClick={()=>switchStep('signin')}>Back to sign in</button>}
        </div>
        <div className="account-guest"><span>Just exploring?</span><button onClick={onContinueGuest} type="button">Continue without account ↗</button></div>
      </>}
      <p className="account-fineprint">Accounts run on AWS Cognito when configured. Your saved trips in this version stay on this device, not synchronized to the cloud.</p>
    </section>
  </div>;
}
