import React from 'react'
import { createRoot } from 'react-dom/client'
import ComputerPage from '../pages/computer'
import FreePage from '../pages/free'
import HalfAdderPage from '../pages/halfadder'

// Optional offline DOM harness for environments without browser networking.
// CI instead starts Next.js and visits real pages; no fetch mocking there.
const state = window as unknown as { __layouts: Record<string, unknown>, __pageName: string }
window.fetch = async (url: RequestInfo | URL) => {
    const name = String(url).split('/').pop()!.replace('.json', '')
    if (!state.__layouts[name]) throw Error(`missing offline layout: ${name}`)
    return new Response(JSON.stringify(state.__layouts[name]), { headers: { 'content-type': 'application/json' } })
}
const Page = state.__pageName === 'free' ? FreePage : state.__pageName === 'halfadder' ? HalfAdderPage : ComputerPage
createRoot(document.getElementById('root')!).render(<React.StrictMode><Page/></React.StrictMode>)
