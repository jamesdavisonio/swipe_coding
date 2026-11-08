// "Notify me of decisions" in the overview (docs/features/decision-notifications.md): on, this
// browser gets a phone notification whenever a session puts a decision on the board.
import { Switch } from '../ui/switch.tsx'
import { Bell, BellOff } from '../../lib/icons.ts'
import { useNotifySwitch } from './use-notify-switch.ts'

export default function NotifySwitch() {
  const notify = useNotifySwitch()
  return (
    <div className="mt-4">
      <Switch
        checked={notify.on}
        disabled={notify.unsupported}
        busy={notify.busy}
        icon={notify.on ? <Bell aria-hidden="true" /> : <BellOff aria-hidden="true" />}
        onToggle={() => void notify.toggle()}
      >
        Notify me of decisions
      </Switch>
      <p aria-live="polite" className="mt-1.5 text-sm text-muted-foreground empty:hidden">
        {notify.line}
      </p>
    </div>
  )
}
