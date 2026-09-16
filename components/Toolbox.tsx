import * as React from 'react'
import { Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, MUXGate, DFF, Cross, Memory } from './gates'

export const tools = [Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, MUXGate, DFF, Cross, Memory, 'Interact', 'Erase', 'Wire'] as const
export type Tool = typeof tools[number]
export class Toolbox extends React.Component<{tool:Tool,setTool:React.Dispatch<React.SetStateAction<Tool>>}> {
    private key=(e:KeyboardEvent)=>{
        if(['INPUT','TEXTAREA','SELECT'].includes((e.target as Element)?.tagName)||e.ctrlKey||e.metaKey||e.altKey)return
        const binds={Escape:'Interact',Backspace:'Erase',Enter:'Wire'}
        if(e.key in binds){e.preventDefault();this.props.setTool(binds[e.key] as Tool)}
        if(/^[1-9]$/.test(e.key))this.props.setTool(()=>tools[Number(e.key)-1])
    }
    componentDidMount(){addEventListener('keydown',this.key)}
    componentWillUnmount(){removeEventListener('keydown',this.key)}
    render(){return <div className="flex justify-center flex-wrap select-none" data-native-toolbox="true" style={{display:'flex',flexWrap:'wrap',gap:4}}>
        {tools.map((t,i)=><button key={i} data-tool={typeof t==='string'?t:t.type} style={{fontWeight:t===this.props.tool?700:400}}
            onClick={()=>this.props.setTool(()=>t)}>{typeof t==='string'?t:t.type}</button>)}
    </div>}
}
