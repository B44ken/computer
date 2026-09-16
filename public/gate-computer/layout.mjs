// Integer-grid, single-plane routing. Unrelated nets may only intersect at a
// straight orthogonal crossing, represented by an explicit isolated Cross.
const DX=[-1,1,0,0], DY=[0,0,-1,1], MASK=[1,2,4,8], OPP=[1,0,3,2];
const key=(x,y)=>`${x},${y}`;
// Distances along each routed net let directional Cross inputs face its driver.
function signalDepths(edges,pins) {
  const graphs=new Map(),depths=new Map();
  for(const e of edges) {
    if(!graphs.has(e.net))graphs.set(e.net,new Map());const graph=graphs.get(e.net);
    const a=key(...e.a),b=key(...e.b);
    for(const [x,y] of [[a,b],[b,a]]){if(!graph.has(x))graph.set(x,[]);graph.get(x).push(y);}
  }
  for(const p of pins.filter(p=>p.output)) {
    const graph=graphs.get(p.net),queue=[key(p.x,p.y)],d=new Map([[queue[0],0]]);
    for(let i=0;i<queue.length;i++)for(const n of graph?.get(queue[i])||[])if(!d.has(n)){d.set(n,d.get(queue[i])+1);queue.push(n);}
    depths.set(p.net,d);
  }
  return depths;
}
const crossSides={ '-45':['W','N','E','S'],45:['N','E','S','W'],135:['E','S','W','N'],225:['S','W','N','E'] };
const sideDelta={W:[-1,0],N:[0,-1],E:[1,0],S:[0,1]};
export function cellPins(c) {
  const {x,y,w=6,h=4}=c;
  if(c.type==='MEMORY') return c.pins;
  if(c.type==='INPUT') return [{name:'out',net:'clk',x:x+w,y:y+2,dir:1,output:true}];
  const p=c.inputs.map((net,i)=>({name:c.type==='DFF'?['D','CLK'][i]:['A','B','S'][i],net,
    x:(c.type==='MUX'&&i===2)||(c.type==='DFF'&&i===1)?x+3:x,
    y:(c.type==='MUX'&&i===2)||(c.type==='DFF'&&i===1)?y+h:y+(c.type==='NOT'?2:i*2+1),
    dir:(c.type==='MUX'&&i===2)||(c.type==='DFF'&&i===1)?3:0,output:false}));
  p.push({name:'Q',net:c.output,x:x+w,y:y+2,dir:1,output:true});return p;
}
function memoryNode(manual) {
  const x=manual?14:20,y=18,w=14,h=manual?116:104,pins=[];
  let n=0;
  for(const [name,size,prefix] of [['pc',6,'pc'],['addr',6,'inst'],['write',8,'a']])
    for(let i=0;i<size;i++)pins.push({name:`${name}${i}`,net:`${prefix}[${i}]`,x,y:y+4+4*n++,dir:0,output:false});
  for(const net of ['we','clk'])pins.push({name:net,net,x,y:y+4+4*n++,dir:0,output:false});
  for(let i=0;i<8;i++)pins.push({name:`inst${i}`,net:`inst[${i}]`,x:x+w,y:y+4+2*i,dir:1,output:true});
  for(let i=0;i<8;i++)pins.push({name:`data${i}`,net:`data[${i}]`,x:x+w,y:manual?44+11*i:y+26+9*i,dir:1,output:true});
  return {id:'memory',type:'MEMORY',x,y,w,h,pins};
}
export function place(netlist,variant=netlist.variant) {
  const manual=variant==='manual',memory=memoryNode(manual);
  const nodes=netlist.cells.map(c=>({...c,w:6,h:4}));
  const groups=[];
  if(manual) {
    for(const c of nodes) {
      if(c.group==='alu') {c.x=48+c.col*12;c.y=42+c.bit*11;}
      if(c.group==='acc') {c.x=104+c.col*12;c.y=42+c.bit*11;}
      if(c.group==='pc') {c.x=48+c.col*12;c.y=162+c.bit*11;}
      if(c.group==='zero') {c.x=145+c.col*12;c.y=52+c.bit*16;}
      if(c.group==='decode') {c.x=144;c.y=148+c.bit*14;}
    }
    groups.push({title:'subtract: A + ~M + 1',x:43,y:33,w:55,h:96},
      {title:'accumulator: choose → hold → DFF',x:99,y:33,w:41,h:96},
      {title:'zero detector',x:141,y:40,w:42,h:69},
      {title:'program counter: +1 or jump',x:43,y:151,w:55,h:80},
      {title:'decode',x:139,y:138,w:35,h:69});
  } else {
    // Deterministic simulated-annealing placement, minimizing pin-net HPWL.
    const slots=Array.from({length:108},(_,i)=>({x:44+(i%9)*13,y:12+Math.floor(i/9)*11}));
    const placed=[...nodes,...Array.from({length:slots.length-nodes.length},(_,i)=>({id:`empty${i}`,type:'EMPTY'}))];
    placed.forEach((c,i)=>Object.assign(c,slots[i]));
    const netCells=new Map();
    for(const c of nodes) for(const n of new Set([...c.inputs,c.output])){
      if(!netCells.has(n))netCells.set(n,[]);netCells.get(n).push(c);
    }
    const fixed=[...cellPins(memory),{net:'clk',x:8,y:8}];
    const hpwl=n=>{const pts=[...(netCells.get(n)||[]).map(c=>({x:c.x+3,y:c.y+2})),...fixed.filter(p=>p.net===n)];
      return pts.length<2?0:Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y));};
    let seed=0x41c6ce57;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const swap=(a,b)=>{[a.x,b.x]=[b.x,a.x];[a.y,b.y]=[b.y,a.y];};
    for(let k=0;k<18000;k++) {
      const a=placed[Math.floor(random()*placed.length)],b=placed[Math.floor(random()*placed.length)];
      if(a===b)continue;
      const affected=new Set([...(a.inputs||[]),...(b.inputs||[]),a.output,b.output].filter(Boolean));
      const before=[...affected].reduce((s,n)=>s+hpwl(n),0);swap(a,b);
      const delta=[...affected].reduce((s,n)=>s+hpwl(n),0)-before;
      const temp=14*Math.pow(.02,k/18000);
      if(delta>0&&random()>Math.exp(-delta/temp))swap(a,b);
    }
  }
  if(manual){for(const c of nodes)c.x+=18;memory.x+=18;memory.pins.forEach(p=>p.x+=18);groups.forEach(g=>g.x+=18);}
  nodes.push(memory,{id:'clock',type:'INPUT',x:4,y:4,w:6,h:4});
  return {variant,nodes,groups,width:manual?216:172,height:manual?244:158};
}
class Heap {
  a=[];
  push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}
  pop(){const top=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1][0]<this.a[c][0])c++;if(this.a[c][0]>=v[0])break;this.a[i]=this.a[c];i=c;}this.a[i]=v;}return top;}
}
function routeOnce(placement,priority=[]) {
  const {width:W,height:H,nodes}=placement;
  const at=(x,y)=>y*W+x,xy=id=>[id%W,Math.floor(id/W)];
  const blocked=new Uint8Array(W*H),reserve=new Map(),usage=new Map(),edges=new Map(),nets=new Map();
  const pins=nodes.flatMap(c=>cellPins(c).map(p=>({...p,node:c.id})));
  for(const c of nodes)for(let y=c.y;y<=c.y+c.h;y++)for(let x=c.x;x<=c.x+c.w;x++)blocked[at(x,y)]=1;
  const memory=nodes.find(c=>c.type==='MEMORY');
  const labels=[{x:memory.x-1,y:memory.y-6,w:memory.w+2,h:5},...placement.groups.map(g=>({x:g.x,y:g.y-4,w:Math.ceil(g.title.length*.91)+2,h:3}))];
  for(const r of labels)for(let y=r.y;y<=r.y+r.h;y++)for(let x=r.x;x<=r.x+r.w;x++)blocked[at(x,y)]=1;
  for(const p of pins) {
    if(!nets.has(p.net))nets.set(p.net,{name:p.net,pins:[],vertices:new Set()});nets.get(p.net).pins.push(p);
    for(let k=0;k<=2;k++) {
      const id=at(p.x+DX[p.dir]*k,p.y+DY[p.dir]*k);
      if(reserve.has(id)&&reserve.get(id)!==p.net)throw Error('overlapping pin escapes');
      reserve.set(id,p.net);if(k===0)blocked[id]=0;
    }
  }
  const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  function addPath(net,path) {
    for(let i=1;i<path.length;i++) {
      const a=path[i-1],b=path[i],delta=b-a,dir=delta===-1?0:delta===1?1:delta===-W?2:3;
      if(![1,W].includes(Math.abs(delta)))throw Error('non-unit path');
      const ek=edgeKey(a,b);if(edges.has(ek)&&edges.get(ek).net!==net.name)throw Error('shorted edge');
      edges.set(ek,{a,b,net:net.name});
      for(const [v,d] of [[a,dir],[b,OPP[dir]]]) {
        if(!usage.has(v))usage.set(v,new Map());
        const m=usage.get(v);m.set(net.name,(m.get(net.name)||0)|MASK[d]);net.vertices.add(v);
      }
    }
  }
  const permitted=(v,n)=>v>=0&&v<W*H&&!blocked[v]&&(!reserve.has(v)||reserve.get(v)===n);
  function pathToTree(start,net) {
    const tree=new Set([...net.vertices].filter(v=>usage.get(v)?.size===1));
    const pts=[...tree].map(xy),loX=Math.min(...pts.map(p=>p[0])),hiX=Math.max(...pts.map(p=>p[0])),loY=Math.min(...pts.map(p=>p[1])),hiY=Math.max(...pts.map(p=>p[1]));
    const heuristic=v=>{const [x,y]=xy(v);return Math.max(loX-x,0,x-hiX)+Math.max(loY-y,0,y-hiY);};
    const heap=new Heap(),dist=new Map(),parent=new Map();
    const initial=start*5+4;dist.set(initial,0);heap.push([heuristic(start),initial,0]);let end;
    while(heap.a.length) {
      const [,state,cost]=heap.pop();if(cost!==dist.get(state))continue;
      const v=Math.floor(state/5),last=state%5;
      if(tree.has(v)){end=state;break;}
      const [x,y]=xy(v);
      for(let d=0;d<4;d++) {
        let nx=x+DX[d],ny=y+DY[d];if(nx<1||ny<1||nx>=W-1||ny>=H-1)continue;
        let u=at(nx,ny);if(!permitted(u,net.name))continue;
        const crossed=[];let legal=true;
        while(usage.has(u)&&[...usage.get(u).keys()].some(n=>n!==net.name)) {
          const occ=usage.get(u),foreign=[...occ.keys()].find(n=>n!==net.name);
          if(occ.size!==1||occ.get(foreign)!==(d<2?12:3)||reserve.has(u)){legal=false;break;}
          crossed.push(u);nx+=DX[d];ny+=DY[d];u=at(nx,ny);
          if(nx<1||ny<1||nx>=W-1||ny>=H-1||!permitted(u,net.name)){legal=false;break;}
        }
        if(!legal)continue;
        const ns=u*5+d,nd=cost+(1+4*crossed.length)+(last!==4&&last!==d?.35:0);
        if(nd<(dist.get(ns)??Infinity)) {dist.set(ns,nd);parent.set(ns,{prev:state,crossed});heap.push([nd+heuristic(u),ns,nd]);}
      }
    }
    if(end===undefined) {const e=Error(`unrouted ${net.name} at ${xy(start)}`);e.failedNet=net.name;throw e;}
    const path=[];
    for(let s=end;s!==initial;) {path.push(Math.floor(s/5));const p=parent.get(s);path.push(...p.crossed.slice().reverse());s=p.prev;}
    path.push(start);return path.reverse();
  }
  const list=[...nets.values()].sort((a,b)=>{const ar=priority.indexOf(a.name),br=priority.indexOf(b.name);return (ar<0?999:ar)-(br<0?999:br)||b.pins.length-a.pins.length||a.name.localeCompare(b.name);});
  for(const net of list) {
    const drivers=net.pins.filter(p=>p.output);if(drivers.length!==1)throw Error(`driver count ${net.name}: ${drivers.length}`);
    const src=drivers[0],sp=at(src.x,src.y),ss=at(src.x+DX[src.dir],src.y+DY[src.dir]);
    addPath(net,[sp,ss]);
    const sinks=net.pins.filter(p=>!p.output).sort((a,b)=>Math.abs(a.x-src.x)+Math.abs(a.y-src.y)-Math.abs(b.x-src.x)-Math.abs(b.y-src.y));
    for(const p of sinks) {
      const pin=at(p.x,p.y),stub=at(p.x+DX[p.dir],p.y+DY[p.dir]);
      if(!net.vertices.has(stub))addPath(net,pathToTree(stub,net));
      addPath(net,[stub,pin]);
    }
  }
  const routedEdges=[...edges.values()].map(e=>({...e,a:xy(e.a),b:xy(e.b)}));
  const depths=signalDepths(routedEdges,pins),crosses=[],junctions=[];
  for(const [v,occ] of usage) {
    if(occ.size>1) {
      if(occ.size!==2||![...occ.values()].includes(3)||![...occ.values()].includes(12))throw Error('illegal crossing');
      const [x,y]=xy(v),h=[...occ].find(([,m])=>m===3)[0],vert=[...occ].find(([,m])=>m===12)[0];
      const west=depths.get(h).get(key(x-1,y))<depths.get(h).get(key(x+1,y));
      const north=depths.get(vert).get(key(x,y-1))<depths.get(vert).get(key(x,y+1));
      const rotation=north?(west?-45:45):(west?225:135),sides=crossSides[rotation];
      // The original directional TL→BR / TR→BL channels face the actual
      // upstream drivers, not merely two cosmetic intersecting lines.
      crosses.push({id:`cross_${x}_${y}`,type:'Cross',x,y,h,v:vert,rotation,
        channels:[{from:'TL',to:'BR',net:['W','E'].includes(sides[0])?h:vert},
          {from:'TR',to:'BL',net:['W','E'].includes(sides[1])?h:vert}]});
    } else for(const [net,mask] of occ) if(mask.toString(2).replaceAll('0','').length>=3){const [x,y]=xy(v);junctions.push({x,y,net});}
  }
  const result={...placement,edges:routedEdges,crosses,junctions,pins};
  result.metrics={gates:nodes.filter(c=>!['MEMORY','INPUT'].includes(c.type)).length,crossovers:crosses.length,nets:nets.size,wireLength:edges.size,width:W,height:H,area:W*H};
  validateLayout(result);return result;
}
export function validateLayout(layout) {
  const {nodes,edges,pins,crosses}=layout;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++) {
    const a=nodes[i],b=nodes[j];
    if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)throw Error(`overlap ${a.id}/${b.id}`);
  }
  // Re-extract electrical connectivity FROM GEOMETRY, without trusting net IDs.
  const crossMap=new Map(crosses.map(c=>[key(c.x,c.y),c])),parent=new Map();
  const find=x=>{if(!parent.has(x))parent.set(x,x);let p=x;while(parent.get(p)!==p)p=parent.get(p);while(x!==p){const y=parent.get(x);parent.set(x,p);x=y;}return p;};
  const join=(a,b)=>parent.set(find(a),find(b));
  const vertex=(p,axis)=>key(...p)+(crossMap.has(key(...p))?`/${axis}`:'');
  const segmentSet=new Set();
  for(const e of edges) {
    const [x,y]=e.a,[u,v]=e.b;if(Math.abs(x-u)+Math.abs(y-v)!==1)throw Error('non-Manhattan segment');
    const ek=[key(x,y),key(u,v)].sort().join(':');if(segmentSet.has(ek))throw Error('duplicate segment');segmentSet.add(ek);
    const axis=y===v?'h':'v';join(vertex(e.a,axis),vertex(e.b,axis));
    const mx=(x+u)/2,my=(y+v)/2;
    for(const c of nodes)if(mx>c.x&&mx<c.x+c.w&&my>c.y&&my<c.y+c.h)throw Error(`wire through ${c.id}`);
  }
  const componentNets=new Map(),netComponents=new Map(),drivers=new Map();
  for(const p of pins) {
    const root=find(key(p.x,p.y));
    if(p.output)drivers.set(root,(drivers.get(root)||0)+1);
    if(!componentNets.has(root))componentNets.set(root,new Set());componentNets.get(root).add(p.net);
    if(!netComponents.has(p.net))netComponents.set(p.net,new Set());netComponents.get(p.net).add(root);
  }
  for(const [r,ns] of componentNets){if(ns.size!==1)throw Error('short: '+[...ns].join(', '));if(drivers.get(r)!==1)throw Error('missing or multiple drivers');}
  for(const [n,cs] of netComponents)if(cs.size!==1)throw Error('open: '+n);
  for(const e of edges) {
    const axis=e.a[1]===e.b[1]?'h':'v',ns=componentNets.get(find(vertex(e.a,axis)));
    if(!ns||ns.size!==1||!ns.has(e.net))throw Error('mislabelled or floating wire');
  }
  const depths=signalDepths(edges,pins);
  for(const c of crosses) {
    if(c.h===c.v)throw Error('unnecessary crossover');
    for(const axis of ['h','v']){
      const expected=axis==='h'?c.h:c.v;
      if(!componentNets.get(find(`${c.x},${c.y}/${axis}`))?.has(expected))throw Error('miswired crossover channel');
      const incident=edges.filter(e=>e.a[axis==='h'?1:0]===c[axis==='h'?'y':'x']&&e.b[axis==='h'?1:0]===c[axis==='h'?'y':'x']&&(key(...e.a)===key(c.x,c.y)||key(...e.b)===key(c.x,c.y)));
      if(incident.length!==2||incident.some(e=>e.net!==expected))throw Error('incomplete crossover');
    }
    if(find(`${c.x},${c.y}/h`)===find(`${c.x},${c.y}/v`))throw Error('shorted crossover');
    const sides=crossSides[c.rotation];if(!sides||c.channels.length!==2)throw Error('invalid crossover ports');
    for(let i=0;i<2;i++) {
      const ch=c.channels[i],side=sides[i],out=sides[i+2],net=['W','E'].includes(side)?c.h:c.v;
      if(ch.from!==['TL','TR'][i]||ch.to!==['BR','BL'][i]||ch.net!==net)throw Error('invalid crossover channel mapping');
      const [dx,dy]=sideDelta[side],[ox,oy]=sideDelta[out],d=depths.get(net);
      if(!(d.get(key(c.x+dx,c.y+dy))<d.get(key(c.x+ox,c.y+oy))))throw Error('crossover faces away from driver');
    }
  }
  return {ok:true,pins:pins.length,nets:netComponents.size,opens:0,shorts:0,overlaps:0};
}

export function route(placement) {
  const priority=[];
  for(let attempt=0;attempt<24;attempt++) {
    try {const result=routeOnce(placement,priority);result.metrics.routingPasses=attempt+1;return result;}
    catch(e){
      if(!e.failedNet)throw e;
      const i=priority.indexOf(e.failedNet);if(i>=0)priority.splice(i,1);
      priority.unshift(e.failedNet);
      if(attempt===23)throw e;
    }
  }
}
