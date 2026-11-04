import { useSearchParams } from 'react-router-dom'
import { PROJECT_TAB_PARAM, isDefaultTab, parseTab, type ProjectTab } from './projects.ts'

// The project's current tab, kept in the `tab` search param (the default tab leaves it out), and
// the function that changes it. Replaces the history entry, so Back leaves the project.
export function useProjectTab(): [ProjectTab, (tab: ProjectTab) => void] {
  const [params, setParams] = useSearchParams()
  const tab = parseTab(params.get(PROJECT_TAB_PARAM))
  function choose(next: ProjectTab) {
    const nextParams = new URLSearchParams(params)
    if (isDefaultTab(next)) nextParams.delete(PROJECT_TAB_PARAM)
    else nextParams.set(PROJECT_TAB_PARAM, next)
    setParams(nextParams, { replace: true })
  }
  return [tab, choose]
}
