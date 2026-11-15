import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { BackupReminder } from './components/BackupReminder'
import { IconChart, IconDumbbell, IconList } from './components/Icons'
import { useSettings } from './hooks'
import { t } from './i18n'
import { applyTheme, isTheme } from './theme'
import { navigate, useRoute } from './router'
import { ActiveSession } from './screens/ActiveSession'
import { ExerciseEdit } from './screens/ExerciseEdit'
import { Library } from './screens/Library'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'
import { TemplateEdit } from './screens/TemplateEdit'
import { Timer } from './screens/Timer'
import { Trainings } from './screens/Trainings'

export function App() {
  const { parts } = useRoute()
  const [first, second] = parts
  useRegisterSW({ immediate: true })
  const { theme } = useSettings()
  useEffect(() => {
    if (isTheme(theme)) applyTheme(theme)
  }, [theme])

  let screen
  let tab: 'trainings' | 'library' | 'stats' | null = null
  switch (first) {
    case 'session':
      screen = <ActiveSession key={second} id={second} />
      break
    case 'timer':
      screen = <Timer />
      break
    case 'settings':
      screen = <Settings />
      break
    case 'exercise':
      screen = <ExerciseEdit key={second} id={second} />
      break
    case 'template':
      screen = <TemplateEdit key={second} id={second} />
      break
    case 'library':
      tab = 'library'
      screen = <Library segment={second === 'templates' ? 'templates' : 'exercises'} />
      break
    case 'stats':
      tab = 'stats'
      screen = <Stats />
      break
    default:
      tab = 'trainings'
      screen = <Trainings />
  }

  return (
    <div className={`app ${tab ? 'with-tabs' : ''}`}>
      {screen}
      <BackupReminder />
      {tab && (
        <nav className="tabbar">
          <button className={tab === 'trainings' ? 'on' : ''} onClick={() => navigate('/', { replace: true })}>
            <IconList />
            <span>{t('tab.trainings')}</span>
          </button>
          <button className={tab === 'library' ? 'on' : ''} onClick={() => navigate('/library', { replace: true })}>
            <IconDumbbell />
            <span>{t('tab.library')}</span>
          </button>
          <button className={tab === 'stats' ? 'on' : ''} onClick={() => navigate('/stats', { replace: true })}>
            <IconChart />
            <span>{t('tab.stats')}</span>
          </button>
        </nav>
      )}
    </div>
  )
}
