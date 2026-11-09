// The inline alert a decision sheet or form shows when its write was refused for good.
export default function SaveError({
  failed,
  message = "Couldn't save. Try again.",
}: {
  failed: boolean
  message?: string
}) {
  if (!failed) return null
  return (
    <p role="alert" className="text-sm font-semibold text-needs">
      {message}
    </p>
  )
}
