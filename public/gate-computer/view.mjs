import {cellPins} from './layout.mjs';
export const CROSS_PATH='M0 0 L1 1 M1 0 L0 1';
export const CROSS_CHANNELS=[['TL','BR'],['TR','BL']];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export function diagram(layout,values={},selected=null) {
  const crosses=new Map(layout.crosses.map(c=>[`${c.x},${c.y}`,c]));
  const paths=new Map();
  for(const e of layout.edges) {
    let [x,y]=e.a,[u,v]=e.b;
    const dx=Math.sign(u-x),dy=Math.sign(v-y);
    if(crosses.has(`${x},${y}`)){x+=dx*.32;y+=dy*.32;}
    if(crosses.has(`${u},${v}`)){u-=dx*.32;v-=dy*.32;}
    if(!paths.has(e.net))paths.set(e.net,[]);paths.get(e.net).push(`M${x} ${y}L${u} ${v}`);
  }
  const color=net=>selected===net?'#783beb':values[net]?'#4476ac':'#a4adb9';
  const opacity=net=>selected&&selected!==net?.14:1;
  let out=`<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="#fcfcfa"/>`;
  for(const group of layout.groups)out+=`<rect x="${group.x}" y="${group.y}" width="${group.w}" height="${group.h}" rx="1" fill="#edf1f4" opacity=".7"/><text x="${group.x+1}" y="${group.y-2}" font-size="1.5" fill="#41516a">${esc(group.title)}</text>`;
  for(const [net,parts] of paths)out+=`<path data-net="${esc(net)}" d="${parts.join('')}" fill="none" stroke="${color(net)}" stroke-width="${selected===net?.32:.13}" opacity="${opacity(net)}" stroke-linecap="round"><title>${esc(net)} = ${values[net]??0}</title></path>`;
  for(const c of layout.crosses) {
    const a=c.rotation*Math.PI/180,cs=Math.round(Math.cos(a)*Math.SQRT2)*.32,sn=Math.round(Math.sin(a)*Math.SQRT2)*.32;
    const transform=`matrix(${cs},${sn},${-sn},${cs},${c.x-(cs-sn)/2},${c.y-(sn+cs)/2})`;
    out+=`<g data-cross="${c.id}" opacity="${selected&&!([c.h,c.v].includes(selected))?.14:1}"><title>Cross · ${esc(c.h)} ↔ ${esc(c.v)} · isolated</title><path d="M${c.x-.32} ${c.y}L${c.x} ${c.y-.32}L${c.x+.32} ${c.y}L${c.x} ${c.y+.32}Z" fill="#fcfcfa" stroke="#9da6b0" stroke-width=".055"/><path d="${CROSS_PATH}" transform="${transform}" fill="none" stroke="#697989" stroke-width=".23"/></g>`;
  }
  for(const j of layout.junctions)out+=`<circle cx="${j.x}" cy="${j.y}" r=".25" fill="${color(j.net)}" opacity="${opacity(j.net)}"/>`;
  for(const c of layout.nodes) {
    const title=`${c.id}${c.inputs?' · '+c.type+'('+c.inputs.join(', ')+')':''}`;
    out+=`<g data-cell="${esc(c.id)}" transform="translate(${c.x},${c.y})"><title>${esc(title)}</title>`;
    if(c.type==='MEMORY') {
      out+=`<rect width="${c.w}" height="${c.h}" rx="1" fill="#e2e8ee" stroke="#60738b" stroke-width=".22"/><text x="${c.w/2}" y="-3.3" text-anchor="middle" font-size="2" fill="#17293d">64 × 8 RAM</text><text x="${c.w/2}" y="-1.2" text-anchor="middle" font-size="1.3" fill="#506377">shared code + data</text>`;
      for(const p of c.pins)out+=`<text x="${p.output?c.w-.7:.7}" y="${p.y-c.y+.4}" text-anchor="${p.output?'end':'start'}" font-size="1.25" fill="#34485d">${p.name}</text>`;
    } else if(c.type==='INPUT')out+='<rect width="6" height="4" rx=".5" fill="#fff" stroke="#37485b" stroke-width=".18"/><path d="M.7 2.6h1v-1.2h1v1.2h1v-1.2h1" fill="none" stroke="#37485b" stroke-width=".2"/>';
    else {
      const fill=selected===c.output?'#ede5ff':c.type==='DFF'?'#dce7f2':'#fff';
      let shape='';
      if(['AND','NAND'].includes(c.type))shape='<path d="M0 1H1V.2H3.1C6 .2 6 3.8 3.1 3.8H1V3H0M1 1V3"/>';
      else if(['OR','NOR','XOR','XNOR'].includes(c.type))shape='<path d="M0 1H1.3M0 3H1.3M1 .2Q3.8 .2 5.5 2Q3.8 3.8 1 3.8Q2.1 2 1 .2Z"/>'+(c.type.includes('X')?'<path d="M.45 .25Q1.5 2 .45 3.75" fill="none"/>':'');
      else if(c.type==='NOT')shape='<path d="M0 2H1M1 .3L4.7 2L1 3.7Z"/><circle cx="5" cy="2" r=".28"/>';
      else if(c.type==='MUX')shape='<path d="M0 1H1M0 3H1M1 0L5 1V3L1 4ZM3 3.5V4"/>';
      else shape='<rect x=".4" y=".2" width="4.9" height="3.6" rx=".25"/><path d="M0 1H.4M3 4V3.8M2.5 3.8L3 3.25L3.5 3.8" fill="none"/>';
      out+=`<g fill="${fill}" stroke="#34485a" stroke-width=".16">${shape}<path d="M5.3 2H6" fill="none"/>${['NAND','NOR','XNOR'].includes(c.type)?'<circle cx="5.45" cy="2" r=".22"/>':''}</g>`;
      if(c.type!=='NOT')out+=`<text x="${c.type==='DFF'?2.9:3}" y="2.42" text-anchor="middle" font-size="${c.type.length>3?.86:1}" fill="#243950">${c.type}</text>`;
      if(layout.variant==='manual'&&['alu','acc','pc'].includes(c.group)&&c.col===0)out+=`<text x="-3.7" y="2.5" font-size="1.6" fill="#526778">${c.bit}</text>`;
    }
    for(const p of cellPins(c))out+=`<circle data-net="${esc(p.net)}" cx="${p.x-c.x}" cy="${p.y-c.y}" r=".19" fill="${values[p.net]?'#4476ac':'#fff'}" stroke="#62778b" stroke-width=".1"><title>${p.name}: ${esc(p.net)} = ${values[p.net]??0}</title></circle>`;
    out+='</g>';
  }
  return out;
}
export function svgFile(layout,values={},selected=null) {
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width*10}" height="${layout.height*10}" font-family="monospace">${diagram(layout,values,selected)}</svg>`;
}
