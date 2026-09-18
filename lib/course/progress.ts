import { lessons, Lesson } from './lessons'
export const progressKey='build-computer:progress:v1'
export const circuitKey=(id:string)=>`build-computer:circuit:v1:${id}`
export type Progress = {labs:Record<string,boolean>,answers:Record<string,number>}
export const emptyProgress=():Progress=>({labs:{},answers:{}})
export function readProgress(raw:string|null):Progress {
    if(!raw)return emptyProgress()
    try{
        const data=JSON.parse(raw),p=emptyProgress()
        for(const l of lessons){for(const id of l.labs)if(data.labs?.[id]===true)p.labs[id]=true
            l.questions.forEach((q,i)=>{const n=data.answers?.[`${l.slug}:${i}`];if(Number.isInteger(n)&&n>=0&&n<q.choices.length)p.answers[`${l.slug}:${i}`]=n})}
        return p
    }catch{return emptyProgress()}
}
export const isComplete=(l:Lesson,p:Progress)=>l.labs.every(id=>p.labs[id])&&l.questions.every((q,i)=>p.answers[`${l.slug}:${i}`]===q.answer)
