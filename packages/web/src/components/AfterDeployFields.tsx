import { useId } from 'react'
import { Field } from './ui/field.tsx'
import { Textarea } from './ui/input.tsx'

// The "I have steps to do after deploy" card: the checkbox, the steps field it reveals (one per
// line) and the stage preview underneath, which changes with the type and the steps.
export default function AfterDeployFields({
  checked,
  onChecked,
  text,
  onText,
  preview,
}: {
  checked: boolean
  onChecked: (checked: boolean) => void
  text: string
  onText: (text: string) => void
  preview: string
}) {
  const stepsId = useId()
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-7 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          checked={checked}
          onChange={(event) => onChecked(event.target.checked)}
        />
        I have steps to do after deploy
      </label>
      {checked ? (
        <Field label="One per line" htmlFor={stepsId}>
          <Textarea
            id={stepsId}
            rows={3}
            placeholder={'Flip the feature flag\nTell the team'}
            value={text}
            onChange={(event) => onText(event.target.value)}
          />
        </Field>
      ) : null}
      <p className="text-sm text-muted-foreground">{preview}</p>
    </div>
  )
}
