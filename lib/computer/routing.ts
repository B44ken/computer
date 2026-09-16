import { coord } from "../coord"
// Integer-grid, single-plane routing. Unrelated nets may only intersect at a
// straight orthogonal crossing, represented by an explicit isolated Cross.
const DX=[-1,1,0,0], DY=[0,0,-1,1], MASK=[1,2,4,8], OPP=[1,0,3,2];
const key=(...p: number[])=>`${p[0]},${p[1]}`;
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
export function cellPins(c) {
  return Object.entries(c.gate.pins).map(([name, pin]: [string, any]) => {
    const p = c.gate.pinPosition(name, coord([c.x,c.y]));
    return {name,net:c.signals[name],x:p.x,y:p.y,dir:pin.type==='out'?1:(c.gate.type==='MUX'&&name==='S'?3:0),output:pin.type==='out'};
  });
}
export function place(nodes, variant) {
  const manual=variant==='manual',memory=nodes.find(c=>c.gate.type==='Memory'), clock=nodes.find(c=>c.gate.type==='Button');
  memory.x=18;memory.y=10;clock.x=4;clock.y=4;
  const cells=nodes.filter(c=>c!==memory&&c!==clock),groups=[];
  if(manual) {
    memory.x=12;memory.y=8;
    for(const c of cells) {
      if(c.group==='alu'){c.x=36+c.col*8;c.y=24+c.bit*8;}
      if(c.group==='acc'){c.x=70+c.col*8;c.y=24+c.bit*8;}
      if(c.group==='zero'){c.x=98+c.col*8;c.y=28+c.bit*14;}
      if(c.group==='pc'){c.x=36+c.col*8;c.y=111+c.bit*8;}
      if(c.group==='decode'){c.x=100;c.y=104+c.bit*10;}
    }
    groups.push({title:'subtract: A + ~M + 1',x:32,y:20,w:34,h:65},
      {title:'choose / hold / store',x:67,y:20,w:25,h:65},
      {title:'zero',x:94,y:23,w:27,h:53},
      {title:'program counter',x:32,y:107,w:34,h:50},
      {title:'decode',x:96,y:99,w:15,h:40});
  } else {
    const slots=Array.from({length:108},(_,i)=>({x:40+(i%9)*10,y:10+Math.floor(i/9)*10}));
    const placed=[...cells,...Array.from({length:slots.length-cells.length},()=>({inputs:[],output:undefined}))];
    placed.forEach((c,i)=>Object.assign(c,slots[i]));
    const netCells=new Map();
    for(const c of cells)for(const n of new Set(Object.values(c.signals))){if(!netCells.has(n))netCells.set(n,[]);netCells.get(n).push(c);}
    const fixed=[...cellPins(memory),...cellPins(clock)];
    const hpwl=n=>{const pts=[...(netCells.get(n)||[]).map(c=>({x:c.x+1,y:c.y+1})),...fixed.filter(p=>p.net===n)];return pts.length<2?0:Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y));};
    let seed=0x41c6ce57;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const swap=(a,b)=>{[a.x,b.x]=[b.x,a.x];[a.y,b.y]=[b.y,a.y];};
    for(let k=0;k<16000;k++){
      const a=placed[Math.floor(random()*placed.length)],b=placed[Math.floor(random()*placed.length)];if(a===b)continue;
      const affected=new Set([...Object.values(a.signals||{}),...Object.values(b.signals||{})]);
      const before=[...affected].reduce<number>((s,n)=>s+hpwl(n),0);swap(a,b);
      const delta=[...affected].reduce<number>((s,n)=>s+hpwl(n),0)-before,temp=10*Math.pow(.025,k/16000);
      if(delta>0&&random()>Math.exp(-delta/temp))swap(a,b);
    }
  }
  for(const c of nodes)if(c!==clock)c.x+=28;for(const g of groups)g.x+=28;
  return {variant,nodes,groups,width:manual?160:166,height:manual?166:136};
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
  const memory=nodes.find(c=>c.gate.type==='Memory');
  const labels=[{x:memory.x-1,y:memory.y-6,w:memory.w+2,h:5},...placement.groups.map(g=>({x:g.x,y:g.y-4,w:Math.ceil(g.title.length*.62)+2,h:3}))];
  for(const r of labels)for(let y=r.y;y<=r.y+r.h;y++)for(let x=r.x;x<=r.x+r.w;x++)blocked[at(x,y)]=1;
  for(const p of pins) {
    if(!nets.has(p.net))nets.set(p.net,{name:p.net,pins:[],vertices:new Set()});nets.get(p.net).pins.push(p);
    for(let k=0;k<=1;k++) {
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
    if(end===undefined) {const e=Error(`unrouted ${net.name} at ${xy(start)}`) as Error & {failedNet:string};e.failedNet=net.name;throw e;}
    const path=[];
    for(let s=end;s!==initial;) {path.push(Math.floor(s/5));const p=parent.get(s);path.push(...p.crossed.slice().reverse());s=p.prev;}
    path.push(start);return path.reverse();
  }
  let manualConnections=0;
  if(placement.variant==='manual')for(const net of nets.values()) {
    const src=net.pins.find(p=>p.output);if(!src)continue;
    const source=nodes.find(c=>c.id===src.node);
    for(const dst of net.pins.filter(p=>!p.output)) {
      const sink=nodes.find(c=>c.id===dst.node);
      if(source.group!==sink.group||source.bit!==sink.bit||sink.col!==source.col+1||dst.dir!==0)continue;
      const mid=src.x+3,waypoints=[[src.x,src.y],[mid,src.y],[mid,dst.y],[dst.x,dst.y]],path=[];
      for(let i=1;i<waypoints.length;i++) {
        let [x,y]=waypoints[i-1], [tx,ty]=waypoints[i];
        if(!path.length)path.push(at(x,y));
        while(x!==tx||y!==ty){x+=Math.sign(tx-x);y+=Math.sign(ty-y);path.push(at(x,y));}
      }
      if(path.every(v=>permitted(v,net.name)&&(!usage.has(v)||[...usage.get(v).keys()].every(n=>n===net.name)))) {addPath(net,path);manualConnections++;}
    }
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
  result.metrics={gates:nodes.filter(c=>!['Memory','Button'].includes(c.gate.type)).length,crossovers:crosses.length,nets:nets.size,wireLength:edges.size,manualConnections,width:W,height:H,area:W*H};
  return result;
}
export function route(placement) {
  const priority=[];
  for(let attempt=0;attempt<40;attempt++) {
    try {const result=routeOnce(placement,priority);result.metrics['routingPasses']=attempt+1;return result;}
    catch(e){
      if(!e.failedNet)throw e;
      const i=priority.indexOf(e.failedNet);if(i>=0)priority.splice(i,1);
      priority.unshift(e.failedNet);
      if(attempt===39)throw e;
    }
  }
}
