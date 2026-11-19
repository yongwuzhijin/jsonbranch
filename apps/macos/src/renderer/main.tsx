import { chooseLocale } from '../../../../src/shared/locale'
import { createRoot } from 'react-dom/client'
import { MacApp } from './MacApp'

document.documentElement.lang = chooseLocale(navigator.language)

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<MacApp />)
}
