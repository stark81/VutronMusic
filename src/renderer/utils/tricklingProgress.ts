import 'trickling/lib/style.css'
import { createTrickling } from 'trickling'

export const tricklingProgress = createTrickling({
  showSpinner: false,
  color: 'var(--primary-color)'
  // color: '#335eea'
})
