// Dark mode: a `.dark` class on <html>, driven by the system preference unless James has
// saved a choice. Tokens in styles/tokens.css do the rest.
const STORAGE_KEY = 'kanban.theme'

export type Theme = 'light' | 'dark' | 'system'

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system' // storage blocked (private mode): follow the system
  }
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch (err) {
    console.warn('theme preference not saved', err)
  }
  applyTheme()
}

function resolve(theme: Theme, systemDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemDark)
}

// Apply once now and again whenever the system preference changes. Returns the unsubscribe.
export function applyTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    document.documentElement.classList.toggle('dark', resolve(getTheme(), media.matches))
  }
  apply()
  media.addEventListener('change', apply)
  return () => media.removeEventListener('change', apply)
}
