// The inline alert a decision sheet shows when its write was refused for good.
export default function SaveError({ failed }: { failed: boolean }) {
  if (!failed) return null
  return (
    <p role="alert" className="text-sm font-semibold text-needs">
      Couldn't save. Try again.
    </p>
  )
}
