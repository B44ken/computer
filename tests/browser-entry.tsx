import React from 'react'
import { createRoot } from 'react-dom/client'
import ComputerPage from '../pages/computer'

// Offline DOM harness: the only fetches are the two checked-in layouts.
// The same page, gate implementations and geometric simulator run unchanged.
const layouts = (window as unknown as { __layouts: Record<string, unknown> }).__layouts
window.fetch = async (url: RequestInfo | URL) => {
    const name = String(url).split('/').pop()!.replace('.json', '')
    if (!layouts[name]) throw Error(`missing offline layout: ${name}`)
    return new Response(JSON.stringify(layouts[name]), { headers: { 'content-type': 'application/json' } })
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ComputerPage/></React.StrictMode>)
