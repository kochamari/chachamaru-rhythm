// Original drum and festival sound effects, synthesised as sample buffers.
// Pure functions: the same sample rate always gives the same samples, which
// keeps them testable and lets the engine prepare them once per session.

/** 和太鼓 voices: standard, a small tight drum (higher, lighter), a big drum (deeper, heavier), and the standard in a hall. */
export type HitSound='taiko'|'shime'|'odaiko'|'hibiki';
export const HIT_SOUNDS:readonly HitSound[]=['taiko','shime','odaiko','hibiki'];
/** The voice to play for a saved choice (earlier versions' 'pop' and 'wood', or none, play the standard drum). */
export function hitSoundOf(saved:string|undefined):HitSound{return HIT_SOUNDS.includes(saved as HitSound)?saved as HitSound:'taiko';}
export type EffectName='combo10'|'combo50'|'combo100'|'fullCombo'|'allGreat'|'clear'|'fail'|'chorus'|'select'|'move'|'back'|'tick'|'balloon'|'count'|'fever'|'fullHouse'|'gachaTurn'|'gachaOpen'|'gachaRare'|'join'|'reel';

function rng(seed:number){return ()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296*2-1;};}

/** RBJ biquad band-pass (constant skirt gain) applied in place. */
export function bandpass(x:Float32Array,sr:number,freq:number,q:number){
 const w=2*Math.PI*freq/sr,alpha=Math.sin(w)/(2*q),cos=Math.cos(w);
 const b0=alpha,b2=-alpha,a0=1+alpha,a1=-2*cos,a2=1-alpha;
 let x1=0,x2=0,y1=0,y2=0;
 for(let i=0;i<x.length;i++){const v=x[i];const y=(b0*v+b2*x2-a1*y1-a2*y2)/a0;x2=x1;x1=v;y2=y1;y1=y;x[i]=y;}
 return x;
}
export function lowpass(x:Float32Array,sr:number,freq:number,q=.707){
 const w=2*Math.PI*freq/sr,alpha=Math.sin(w)/(2*q),cos=Math.cos(w);
 const b0=(1-cos)/2,b1=1-cos,b2=(1-cos)/2,a0=1+alpha,a1=-2*cos,a2=1-alpha;
 let x1=0,x2=0,y1=0,y2=0;
 for(let i=0;i<x.length;i++){const v=x[i];const y=(b0*v+b1*x1+b2*x2-a1*y1-a2*y2)/a0;x2=x1;x1=v;y2=y1;y1=y;x[i]=y;}
 return x;
}
function noise(n:number,seed:number){const r=rng(seed),a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=r();return a;}
function normalize(x:Float32Array,peak:number){let m=0;for(const v of x)m=Math.max(m,Math.abs(v));if(m>0){const k=peak/m;for(let i=0;i<x.length;i++)x[i]*=k;}return x;}
function fadeEdges(x:Float32Array,sr:number,inMs=.6,outMs=8){const a=Math.floor(sr*inMs/1000),b=Math.floor(sr*outMs/1000);for(let i=0;i<a&&i<x.length;i++)x[i]*=i/a;for(let i=0;i<b&&i<x.length;i++)x[x.length-1-i]*=i/b;return x;}

/** Festival drum, centre stroke: a low swept membrane with a woody thump and a stick click. */
export function renderDon(sr:number):Float32Array{
 const n=Math.floor(sr*.42),out=new Float32Array(n);
 let ph1=0,ph2=0,ph3=0,ph4=0;
 for(let i=0;i<n;i++){
  const t=i/sr;
  const f=108+120*Math.exp(-t/.022);
  ph1+=2*Math.PI*f/sr;ph2+=2*Math.PI*f*1.59/sr;ph3+=2*Math.PI*f*2.14/sr;ph4+=2*Math.PI*(62+30*Math.exp(-t/.03))/sr;
  const att=Math.min(1,t/.0015);
  out[i]=att*(Math.sin(ph1)*Math.exp(-t/.17)+.42*Math.sin(ph2)*Math.exp(-t/.075)+.22*Math.sin(ph3)*Math.exp(-t/.045)+.38*Math.sin(ph4)*Math.exp(-t/.2)*Math.min(1,t/.004));
 }
 // Shell thump so small phone speakers still hear the body.
 const thump=bandpass(noise(n,11),sr,420,1.4);
 const click=bandpass(noise(n,12),sr,2600,.9);
 for(let i=0;i<n;i++){const t=i/sr;out[i]+=thump[i]*2.2*Math.exp(-t/.028)+click[i]*.9*Math.exp(-t/.0035);}
 for(let i=0;i<n;i++)out[i]=Math.tanh(out[i]*1.7)/Math.tanh(1.7);
 return fadeEdges(normalize(out,.95),sr,.3,30);
}

/** Two-pole resonator: `x` rings at `freq`, dying away with time constant `tau` (s). */
function resonate(x:Float32Array,sr:number,freq:number,tau:number){
 const r=Math.exp(-1/(tau*sr)),a1=-2*r*Math.cos(2*Math.PI*freq/sr),a2=r*r,out=new Float32Array(x.length);
 let y1=0,y2=0;
 for(let i=0;i<x.length;i++){const y=x[i]-a1*y1-a2*y2;y2=y1;y1=y;out[i]=y;}
 return out;
}

interface Rim {dur:number;modes:[number,number,number][];click:[number,number,number];drive:number;top:number}
interface Skin {dur:number;f0:number;sweep:number;sweepTau:number;tau:number;modes:[number,number,number][];sub:number;thump:[number,number,number];slap:[number,number,number];drive:number}
// Rim strokes: [frequency, decay time constant (s), level] of the wooden modes;
// the stick's click [frequency, decay, level]. Higher modes die first.
const RIMS:Record<'taiko'|'shime'|'odaiko',Rim>={
 taiko:{dur:.11,modes:[[1050,.005,.3],[2050,.008,1],[3150,.004,.5],[4600,.0022,.25]],click:[5200,.0008,1.3],drive:2.6,top:10000},
 shime:{dur:.1,modes:[[1300,.004,.25],[2600,.0065,1],[3900,.0032,.45],[5600,.0018,.2]],click:[6000,.0007,1.2],drive:2.8,top:11000},
 odaiko:{dur:.12,modes:[[820,.006,.35],[1650,.009,1],[2650,.0045,.5],[4000,.0025,.25]],click:[4500,.0009,1.3],drive:2.4,top:9000},
};
// Centre strokes of the other drums: the membrane's pitch f0 (starting
// `sweep` higher), its modes [ratio, level, decay relative to tau], a sub
// tone, the barrel's thump and the stick's slap [frequency, decay, level].
const SKINS:Record<'shime'|'odaiko',Skin>={
 shime:{dur:.32,f0:170,sweep:140,sweepTau:.015,tau:.1,modes:[[1,1,1],[1.61,.45,.5],[2.18,.25,.3]],sub:.2,thump:[650,.018,1.8],slap:[3200,.003,1.1],drive:1.9},
 odaiko:{dur:.6,f0:78,sweep:95,sweepTau:.03,tau:.3,modes:[[1,1,1],[1.59,.4,.45],[2.14,.2,.28]],sub:.45,thump:[300,.035,2.4],slap:[1800,.004,.8],drive:1.8},
};

/** Rim stroke (fuchi): a hardwood stick on the drum's wooden rim. The strike
 * rings a few wooden modes that die within tens of ms, the higher ones
 * first (wood knocks where metal would ring on), and the stick clicks. */
function rimStroke(sr:number,v:Rim):Float32Array{
 const n=Math.floor(sr*v.dur),out=new Float32Array(n);
 const strike=noise(n,23);
 for(let i=0;i<n;i++)strike[i]*=Math.exp(-i/sr/.0006);
 strike[0]+=1.5;
 for(const [freq,tau,amp] of v.modes){
  const mode=normalize(resonate(strike,sr,freq,tau),1);
  for(let i=0;i<n;i++)out[i]+=amp*mode[i];
 }
 const [cf,ctau,ca]=v.click,click=bandpass(noise(n,24),sr,cf,.8);
 for(let i=0;i<n;i++)out[i]+=click[i]*ca*Math.exp(-i/sr/ctau);
 normalize(out,1);
 for(let i=0;i<n;i++)out[i]=Math.tanh(out[i]*v.drive)/Math.tanh(v.drive);
 lowpass(out,sr,v.top,.6);
 return fadeEdges(normalize(out,.92),sr,.15,12);
}
/** Centre stroke of another drum: the membrane's pitch drops as it settles; the barrel thumps, the stick slaps. */
function centreStroke(sr:number,v:Skin):Float32Array{
 const n=Math.floor(sr*v.dur),out=new Float32Array(n),ph=v.modes.map(()=>0);
 let sub=0;
 for(let i=0;i<n;i++){
  const t=i/sr,f=v.f0+v.sweep*Math.exp(-t/v.sweepTau);let y=0;
  v.modes.forEach(([r,a,d],k)=>{ph[k]+=2*Math.PI*f*r/sr;y+=a*Math.sin(ph[k])*Math.exp(-t/(d*v.tau));});
  sub+=2*Math.PI*(v.f0*.58+25*Math.exp(-t/.03))/sr;
  y+=v.sub*Math.sin(sub)*Math.exp(-t/(v.tau*1.1))*Math.min(1,t/.004);
  out[i]=Math.min(1,t/.0012)*y;
 }
 const [tf,tt,ta]=v.thump,[sf,st,sa]=v.slap;
 const thump=bandpass(noise(n,11),sr,tf,1.3),slap=bandpass(noise(n,12),sr,sf,.9);
 for(let i=0;i<n;i++){const t=i/sr;out[i]+=thump[i]*ta*Math.exp(-t/tt)+slap[i]*sa*Math.exp(-t/st);}
 normalize(out,1);
 for(let i=0;i<n;i++)out[i]=Math.tanh(out[i]*v.drive)/Math.tanh(v.drive);
 return fadeEdges(normalize(out,.95),sr,.3,30);
}
/** The stroke in a small hall (four damped combs and two allpasses), under the dry sound. */
function inHall(x:Float32Array,sr:number,wet:number,seconds:number):Float32Array{
 const n=x.length+Math.floor(sr*seconds),dry=new Float32Array(n),room=new Float32Array(n);
 dry.set(x);
 for(const [ms,g] of [[29.7,.78],[37.1,.76],[41.1,.74],[43.7,.72]]){
  const d=Math.floor(sr*ms/1000),buf=new Float32Array(n);let damped=0;
  for(let i=0;i<n;i++){damped=damped*.35+(i>=d?buf[i-d]:0)*.65;buf[i]=dry[i]+g*damped;room[i]+=buf[i];}
 }
 for(const [ms,g] of [[5,.7],[1.7,.7]]){
  const d=Math.floor(sr*ms/1000),y=new Float32Array(n);
  for(let i=0;i<n;i++)y[i]=-g*room[i]+(i>=d?room[i-d]+g*y[i-d]:0);
  room.set(y);
 }
 lowpass(room,sr,5000);
 normalize(room,wet);
 for(let i=0;i<n;i++)dry[i]+=room[i];
 return fadeEdges(normalize(dry,.92),sr,.1,40);
}

/** Wood blocks, low and high: the steady beat of 音ズレ合わせ (a sharp attack to time against). */
export function renderWood(sr:number,high:boolean):Float32Array{
 const n=Math.floor(sr*(high?.14:.2)),out=new Float32Array(n);
 const base=high?1850:720,modes=[[1,.9,high?.045:.07],[2.76,.45,.025],[5.4,.2,.012]];
 const ph=modes.map(()=>0);
 for(let i=0;i<n;i++){const t=i/sr;let v=0;modes.forEach(([r,a,d],k)=>{ph[k]+=2*Math.PI*base*r/sr;v+=a*Math.sin(ph[k])*Math.exp(-t/d);});out[i]=v*Math.min(1,t/.0006);}
 const snap=bandpass(noise(n,high?51:52),sr,high?3800:2200,1.2);
 for(let i=0;i<n;i++){const t=i/sr;out[i]+=snap[i]*1.8*Math.exp(-t/.004);}
 return fadeEdges(normalize(out,high?.8:.95),sr,.2,15);
}

/** Rim stroke of the standard drum: a high, dry "ka". */
export function renderKa(sr:number):Float32Array{return rimStroke(sr,RIMS.taiko);}

export function renderHit(color:'don'|'ka',set:HitSound,sr:number):Float32Array{
 if(set==='hibiki')return color==='don'?inHall(renderDon(sr),sr,.35,.35):inHall(renderKa(sr),sr,.3,.3);
 if(set==='shime'||set==='odaiko')return color==='don'?centreStroke(sr,SKINS[set]):rimStroke(sr,RIMS[set]);
 return color==='don'?renderDon(sr):renderKa(sr);
}

interface Tone {f:number;t:number;dur:number;amp:number;kind?:'bell'|'flute'|'pluck'}
function mix(target:Float32Array,src:Float32Array,at:number,gain:number){for(let i=0;i<src.length&&at+i<target.length;i++)if(at+i>=0)target[at+i]+=src[i]*gain;}
/** Bell (FM), bamboo flute or plucked string tone. */
export function renderTone(sr:number,tone:Tone,seed=1):Float32Array{
 const n=Math.floor(sr*tone.dur),out=new Float32Array(n);
 const kind=tone.kind??'bell';
 if(kind==='bell'){
  let pc=0,pm=0;
  for(let i=0;i<n;i++){const t=i/sr;pm+=2*Math.PI*tone.f*3.5/sr;pc+=2*Math.PI*tone.f/sr;const idx=2.2*Math.exp(-t/.12);out[i]=Math.sin(pc+idx*Math.sin(pm))*Math.exp(-t/(tone.dur*.35))*Math.min(1,t/.002);}
 }else if(kind==='flute'){
  const breath=lowpass(noise(n,seed),sr,3000);let ph=0;
  for(let i=0;i<n;i++){const t=i/sr;const vib=1+.006*Math.sin(2*Math.PI*5.5*t)*Math.min(1,t/.2);ph+=2*Math.PI*tone.f*vib/sr;const env=Math.min(1,t/.04)*Math.min(1,(tone.dur-t)/.08);out[i]=(Math.sin(ph)+.18*Math.sin(2*ph)+.06*Math.sin(3*ph))*env+breath[i]*.08*env;}
 }else{
  // Karplus–Strong pluck.
  const period=Math.max(2,Math.round(sr/tone.f));const buf=noise(period,seed);let p=0;
  for(let i=0;i<n;i++){const a=buf[p],b=buf[(p+1)%period];buf[p]=(a+b)*.5*.996;out[i]=a;p=(p+1)%period;}
  lowpass(out,sr,Math.min(8000,tone.f*6));
 }
 return fadeEdges(out,sr,.5,15);
}

export function renderSequence(sr:number,tones:Tone[],extra:{don?:number[];ka?:number[]}={},length?:number){
 const end=Math.max(length??0,...tones.map(t=>t.t+t.dur),...(extra.don??[]).map(t=>t+.45),...(extra.ka??[]).map(t=>t+.25));
 const out=new Float32Array(Math.ceil(sr*end));
 tones.forEach((t,i)=>mix(out,renderTone(sr,t,i+3),Math.floor(t.t*sr),t.amp));
 if(extra.don?.length){const d=renderDon(sr);for(const t of extra.don)mix(out,d,Math.floor(t*sr),.55);}
 if(extra.ka?.length){const k=renderKa(sr);for(const t of extra.ka)mix(out,k,Math.floor(t*sr),.4);}
 for(let i=0;i<out.length;i++)out[i]=Math.tanh(out[i]*1.2)/Math.tanh(1.2);
 return normalize(out,.85);
}

// Pentatonic (yo-nuki major) pitches around D5.
const P={D4:293.66,E4:329.63,G4:392,A4:440,B4:493.88,D5:587.33,E5:659.26,G5:783.99,A5:880,B5:987.77,D6:1174.66};
export function renderEffect(name:EffectName,sr:number):Float32Array{
 switch(name){
  case 'combo10':return renderSequence(sr,[{f:P.A5,t:0,dur:.5,amp:.7},{f:P.D6,t:.07,dur:.6,amp:.55}]);
  case 'combo50':return renderSequence(sr,[{f:P.D5,t:0,dur:.5,amp:.6},{f:P.G5,t:.08,dur:.5,amp:.6},{f:P.B5,t:.16,dur:.7,amp:.6}]);
  case 'combo100':return renderSequence(sr,[{f:P.D5,t:0,dur:.4,amp:.55},{f:P.G5,t:.09,dur:.4,amp:.55},{f:P.B5,t:.18,dur:.4,amp:.55},{f:P.D6,t:.27,dur:.9,amp:.7}],{ka:[0,.09,.18]});
  case 'chorus':return renderSequence(sr,[{f:P.G4,t:0,dur:.35,amp:.35,kind:'flute'},{f:P.B4,t:.12,dur:.35,amp:.35,kind:'flute'},{f:P.D5,t:.24,dur:.5,amp:.4,kind:'flute'}],{don:[0]});
  case 'fullCombo':return renderSequence(sr,[
   {f:P.D5,t:.3,dur:.28,amp:.5,kind:'flute'},{f:P.E5,t:.5,dur:.28,amp:.5,kind:'flute'},{f:P.G5,t:.7,dur:.28,amp:.5,kind:'flute'},{f:P.A5,t:.9,dur:.9,amp:.55,kind:'flute'},
   {f:P.D6,t:.9,dur:1.2,amp:.4},{f:P.A5,t:1.0,dur:1.1,amp:.3}],{don:[0,.15,.9],ka:[.3,.5,.7]});
  case 'allGreat':return renderSequence(sr,[
   {f:P.G5,t:.2,dur:.3,amp:.5},{f:P.B5,t:.32,dur:.3,amp:.5},{f:P.D6,t:.44,dur:.3,amp:.5},{f:P.G5,t:.62,dur:1.4,amp:.45,kind:'flute'},
   {f:P.B5,t:.62,dur:1.4,amp:.35},{f:P.D6,t:.62,dur:1.6,amp:.4}],{don:[0,.1,.62],ka:[.2,.32,.44]});
  case 'clear':return renderSequence(sr,[{f:P.D5,t:0,dur:.3,amp:.5,kind:'flute'},{f:P.G5,t:.18,dur:.3,amp:.5,kind:'flute'},{f:P.A5,t:.36,dur:.8,amp:.5,kind:'flute'}],{don:[0,.36]});
  case 'fail':return renderSequence(sr,[{f:P.A4,t:0,dur:.35,amp:.4,kind:'flute'},{f:P.G4,t:.25,dur:.35,amp:.4,kind:'flute'},{f:P.E4,t:.5,dur:.7,amp:.4,kind:'flute'}]);
  case 'select':return renderSequence(sr,[],{don:[0]});
  case 'move':return renderSequence(sr,[],{ka:[0]});
  case 'back':return renderSequence(sr,[{f:P.E5,t:0,dur:.18,amp:.4,kind:'pluck'},{f:P.D5,t:.07,dur:.25,amp:.4,kind:'pluck'}]);
  case 'tick':return renderSequence(sr,[],{ka:[0]});
  case 'count':return renderSequence(sr,[{f:P.A5,t:0,dur:.25,amp:.5}]);
  case 'balloon':return renderSequence(sr,[{f:P.D6,t:0,dur:.2,amp:.4,kind:'pluck'}]);
  // FEVER: a quick run up the scale into a ringing top note.
  case 'fever':return renderSequence(sr,[...[P.D5,P.E5,P.G5,P.A5,P.B5].map((f,i):Tone=>({f,t:i*.045,dur:.22,amp:.42,kind:'pluck'})),{f:P.D6,t:.23,dur:.8,amp:.55},{f:P.A5,t:.23,dur:.7,amp:.3}],{ka:[0],don:[.23]});
  // しばガチャ: the handle's ratchet, a capsule popping open, and a rare find.
  case 'gachaTurn':return renderSequence(sr,[],{ka:[0,.08,.16,.24,.32,.4,.48]});
  case 'gachaOpen':return renderSequence(sr,[{f:P.G5,t:0,dur:.25,amp:.45,kind:'pluck'},{f:P.D6,t:.06,dur:.6,amp:.45}],{don:[0]});
  case 'gachaRare':return renderSequence(sr,[{f:P.D5,t:0,dur:.3,amp:.4},{f:P.G5,t:.1,dur:.3,amp:.45},{f:P.B5,t:.2,dur:.3,amp:.45},{f:P.D6,t:.3,dur:1.2,amp:.55},{f:P.G5,t:.3,dur:1.1,amp:.35,kind:'flute'},{f:P.B5,t:.3,dur:1.2,amp:.3,kind:'flute'}],{don:[0,.3],ka:[.1,.2]});
  // A slot reel ticking by: a tiny, quiet click.
  case 'reel':return renderSequence(sr,[{f:P.A5,t:0,dur:.04,amp:.16,kind:'pluck'}]);
  // A friend comes to dance: a quick hop up.
  case 'join':return renderSequence(sr,[{f:P.B5,t:0,dur:.18,amp:.45,kind:'pluck'},{f:P.E5,t:0,dur:.18,amp:.25,kind:'pluck'},{f:P.D6,t:.09,dur:.5,amp:.5}],{ka:[0]});
  // 全員集合: all the friends are here.
  case 'fullHouse':return renderSequence(sr,[{f:P.G5,t:0,dur:.3,amp:.45,kind:'flute'},{f:P.B5,t:.14,dur:.3,amp:.45,kind:'flute'},{f:P.D6,t:.28,dur:.9,amp:.5,kind:'flute'},{f:P.G5,t:.28,dur:1,amp:.35},{f:P.D6,t:.42,dur:1,amp:.3}],{don:[0,.14,.28],ka:[.07,.21]});
 }
}
