import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { OWNER_EMAIL, OWNER_EMAILS, isOwnerEmail } from '@kanban/shared'
import { auth } from './firebase.ts'

const AuthCtx = createContext<User | null>(null)
export const useUser = () => useContext(AuthCtx)

export function signIn() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ login_hint: OWNER_EMAIL, prompt: 'select_account' })
  return signInWithPopup(auth, provider)
}
export const logOut = () => signOut(auth)

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  if (user === undefined) return <Center>Loading…</Center>

  if (!user) {
    return (
      <Center>
        <div className="card w-full max-w-sm p-6 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-xl font-semibold">Kanban</h1>
          <p className="mt-1 text-sm text-slate-500">Your sessions, your board.</p>
          <button
            className="btn-primary mt-6 w-full"
            onClick={() => signIn().catch(e => setErr(e.message))}
          >
            Sign in with Google
          </button>
          {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
        </div>
      </Center>
    )
  }

  if (!isOwnerEmail(user.email)) {
    return (
      <Center>
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold">Not the owner</h1>
          <p className="mt-2 text-sm text-slate-500">
            Signed in as <span className="font-mono">{user.email}</span>. This board belongs to{' '}
            <span className="font-mono">{OWNER_EMAILS.join(' / ')}</span>.
          </p>
          <button className="btn-outline mt-6 w-full" onClick={() => logOut()}>Sign out</button>
        </div>
      </Center>
    )
  }

  return <AuthCtx.Provider value={user}>{children}</AuthCtx.Provider>
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-6 pt-safe pb-safe">{children}</div>
}
