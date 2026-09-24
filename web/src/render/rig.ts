// Shared puppet rig for Chachamaru. The same data drives the SVG puppet used
// on menus and the WebGL puppet used while playing, so both always agree.
//
// All drawing rectangles are expressed in the 400×420 root space of the
// original SVG puppet. Every bone rotates around a pivot that is also in root
// space. The shoulder and wrist points were registered against the source
// artwork; keep them in sync with tests/e2e/visual.spec.ts when editing.

export type Point=readonly [number,number];
export type Frame=readonly [number,number,number,number];
export type AtlasName='character'|'arms';
export const ATLAS_SIZE=1254;
export const ATLAS_FILES:Record<AtlasName,string>={character:'original-assets/chachamaru-anime-v1.png',arms:'original-assets/chachamaru-overhand-v1.png'};

export const REGIONS={
 head:[10,38,314,278],blink:[329,38,311,278],
 earLeft:[689,37,212,273],earRight:[984,42,224,270],
 torso:[20,329,318,299],tail:[350,328,277,301],
 band:[635,385,312,199],scarf:[964,404,271,187],
 footLeft:[660,628,242,282],footRight:[982,628,238,282],
 drum:[12,920,322,290],flower:[368,954,258,218],
 pawLeft:[647,959,257,247],pawRight:[972,959,262,247],
} as const satisfies Record<string,Frame>;
export type RegionName=keyof typeof REGIONS;

/** One cropped image placed in root coordinates. */
export interface Drawing {atlas:AtlasName;frame:Frame;x:number;y:number;w:number;h:number;role?:'open'|'closed'}
export type BoneName='tail'|'backLeft'|'backRight'|'upperArmLeft'|'upperArmRight'|'scarf'|'head'|'earLeft'|'earRight'|'armLeft'|'armRight';
export interface RigNode {
 /** Stable identifier; also used as the SVG class list. */
 bone?:BoneName;className:string;
 pivot:Point;rest:number;
 drawings:Drawing[];children:RigNode[];
}
export interface RigSpec {
 kind:'drummer'|'dancer';
 /** Parts drawn behind the drum, sharing the body transform. */
 back:RigNode[];
 /** Parts drawn in front of the drum, sharing the body transform. */
 front:RigNode[];
 drum:Drawing|null;
 shadow:{cx:number;cy:number;rx:number;ry:number};
 /** Body squash is anchored at the feet. */
 groundY:number;
}

export function region(part:RegionName,x:number,y:number,width:number):Drawing{
 const f=REGIONS[part];
 return {atlas:'character',frame:f,x,y,w:width,h:width*f[3]/f[2]};
}
/** Place a crop so that the atlas point `attach` lands exactly on `pivot`. */
export function attached(atlas:AtlasName,frame:Frame,attach:Point,scale:number,pivot:Point):Drawing{
 return {atlas,frame,x:pivot[0]+(frame[0]-attach[0])*scale,y:pivot[1]+(frame[1]-attach[1])*scale,w:frame[2]*scale,h:frame[3]*scale};
}
function node(className:string,pivot:Point,drawings:Drawing[],opts:{bone?:BoneName;rest?:number;children?:RigNode[]}={}):RigNode{
 return {className,pivot,drawings,bone:opts.bone,rest:opts.rest??0,children:opts.children??[]};
}
const still=(className:string,d:Drawing)=>node(className,[0,0],[d]);

// Registered shoulder/wrist points of the approved artwork.
export const JOINTS={
 upperArmLeft:{pivot:[147,240] as Point,frame:[710,80,485,450] as Frame,attach:[1037,144] as Point,scale:.13},
 upperArmRight:{pivot:[277,240] as Point,frame:[60,80,485,450] as Frame,attach:[217,144] as Point,scale:.13},
 armLeft:{pivot:[119.31,278.35] as Point,frame:[275,548,282,555] as Frame,attach:[306,986] as Point,scale:.15,stickTip:[505,583] as Point},
 armRight:{pivot:[304.69,278.35] as Point,frame:[697,548,282,555] as Frame,attach:[948,986] as Point,scale:.15,stickTip:[749,583] as Point},
};
/** Drum head as an ellipse in root space: the stick tip must land inside. */
export const DRUM_HEAD={cx:217,cy:285,rx:73,ry:14};

function head(){
 return node('dog-head',[207,217],[],{bone:'head',children:[
  node('dog-ear left',[150,88],[region('earLeft',113,6,75)],{bone:'earLeft'}),
  node('dog-ear right',[278,98],[region('earRight',243,16,83)],{bone:'earRight'}),
  node('dog-eyes',[207,217],[{...region('head',97,41,225),role:'open'},{...region('blink',97,41,225),role:'closed'}]),
 ]});
}
function lowerBody(){
 return [
  node('dog-tail',[287,307],[region('tail',267,206,111)],{bone:'tail'}),
  node('dog-leg back-left',[155,308],[region('footLeft',90,297,85)],{bone:'backLeft'}),
  node('dog-leg back-right',[269,308],[region('footRight',249,297,85)],{bone:'backRight'}),
  still('dog-torso',region('torso',113,182,198)),
 ];
}
const jointArm=(className:string,bone:BoneName,j:typeof JOINTS.armLeft|typeof JOINTS.upperArmLeft)=>node(className,j.pivot,[attached('arms',j.frame,j.attach,j.scale,j.pivot)],{bone});

export const DRUMMER:RigSpec={
 kind:'drummer',
 back:[
  ...lowerBody(),
  jointArm('upper-arm-left','upperArmLeft',JOINTS.upperArmLeft),
  jointArm('upper-arm-right','upperArmRight',JOINTS.upperArmRight),
  node('dog-scarf',[273,223],[region('scarf',254,202,95)],{bone:'scarf'}),
  still('dog-band',region('band',123,183,179)),
 ],
 drum:region('drum',128,267,178),
 front:[
  head(),
  still('dog-flower',region('flower',260,209,67)),
  jointArm('dog-arm arm-left','armLeft',JOINTS.armLeft),
  jointArm('dog-arm arm-right','armRight',JOINTS.armRight),
 ],
 shadow:{cx:207,cy:399,rx:138,ry:11},groundY:391,
};

const PAW_SCALE_LEFT=85/REGIONS.pawRight[2],PAW_SCALE_RIGHT=85/REGIONS.pawLeft[2];
export const DANCER:RigSpec={
 kind:'dancer',
 back:[
  ...lowerBody(),
  node('dog-scarf',[273,223],[region('scarf',254,202,95)],{bone:'scarf'}),
  still('dog-band',region('band',123,183,179)),
 ],
 drum:null,
 front:[
  head(),
  still('dog-flower',region('flower',260,209,67)),
  node('dog-arm arm-left',[142,252],[attached('character',REGIONS.pawRight,[1005,1106],PAW_SCALE_LEFT,[142,252])],{bone:'armLeft',rest:45}),
  node('dog-arm arm-right',[281,252],[attached('character',REGIONS.pawLeft,[871,1118],PAW_SCALE_RIGHT,[281,252])],{bone:'armRight',rest:-45}),
 ],
 shadow:{cx:207,cy:399,rx:120,ry:10},groundY:391,
};

// ---------------------------------------------------------------- poses --

export type Side='left'|'right';
export type Mood='idle'|'chorusDance'|'resultWin';
export interface Pose {
 bodyScaleY:number;bodyY:number;
 angles:Record<BoneName,number>;
 blink:boolean;
 /** Debug label: the dominant state this frame. */
 state:string;
 /** Drum head / rim glow 0..1 for the latest stroke. */
 drumGlow:{don:number;ka:number};
}
export const STRIKE_DOWN_MS=40,STRIKE_UP_MS=90;
/** Rotation that brings each stick tip to the drum head (don) or its front rim (ka). */
export const STRIKE_ANGLE={don:65,ka:78};

export class DrummerState {
 lastLeft=-1e9;lastRight=-1e9;colorLeft:'don'|'ka'='don';colorRight:'don'|'ka'='ka';
 comboAt=-1e9;happyAt=-1e9;missAt=-1e9;
 /**
  * Record a stroke. Touch pads and keys know their side. Without one (MIDI),
  * don prefers the left paw and ka the right, switching paws when that paw is
  * still mid-stroke so quick runs alternate naturally.
  */
 hit(color:'don'|'ka',time:number,side?:Side){
  let s:Side=side??(color==='don'?'left':'right');
  if(!side){const busy=(t:number)=>time-t>=0&&time-t<STRIKE_DOWN_MS+STRIKE_UP_MS;if(s==='left'&&busy(this.lastLeft))s='right';else if(s==='right'&&busy(this.lastRight))s='left';}
  if(s==='left'){this.lastLeft=time;this.colorLeft=color;}else{this.lastRight=time;this.colorRight=color;}
 }
 jump(time:number){this.comboAt=time;}
 react(kind:'happy'|'miss',time:number){if(kind==='happy')this.happyAt=time;else this.missAt=time;}
}

export function strikeEnvelope(age:number){
 if(age<0||age>=STRIKE_DOWN_MS+STRIKE_UP_MS)return 0;
 return age<STRIKE_DOWN_MS?age/STRIKE_DOWN_MS:(STRIKE_DOWN_MS+STRIKE_UP_MS-age)/STRIKE_UP_MS;
}

const zeroAngles=():Record<BoneName,number>=>({tail:0,backLeft:0,backRight:0,upperArmLeft:0,upperArmRight:0,scarf:0,head:0,earLeft:0,earRight:0,armLeft:0,armRight:0});

export function drummerPose(s:DrummerState,time:number,beat:number,mood:Mood):Pose{
 const phase=beat*Math.PI*2,bounce=Math.sin(phase)*3;
 const jump=time>=s.comboAt?Math.max(0,1-(time-s.comboAt)/350):0;
 const left=strikeEnvelope(time-s.lastLeft),right=strikeEnvelope(time-s.lastRight);
 const strike=Math.max(left,right);
 const chorus=mood==='chorusDance',win=mood==='resultWin';
 const missed=time>=s.missAt&&time-s.missAt<120;
 const happy=time>=s.happyAt&&time-s.happyAt<220;
 const kaFlick=Math.max(s.colorLeft==='ka'?left:0,s.colorRight==='ka'?right:0);
 const scale=1-strike*.03;
 const a=zeroAngles();
 a.tail=Math.sin(phase)*6+(chorus?5:0)+(happy?6:0)+kaFlick*9;
 a.head=Math.sin(phase/2)*(chorus?4:2)+(missed?-6:0);
 a.armLeft=left*STRIKE_ANGLE[s.colorLeft]+(chorus?Math.sin(phase/2)*5:0)+(win?-16:0);
 a.armRight=-right*STRIKE_ANGLE[s.colorRight]+(chorus?Math.cos(phase/2)*5:0)+(win?16:0);
 a.backLeft=chorus?Math.max(0,Math.sin(phase))*7:jump*3;
 a.backRight=chorus?Math.max(0,-Math.sin(phase))*-7:jump*-3;
 a.scarf=Math.sin(phase+.4)*(chorus?5:2);
 a.earLeft=Math.sin(phase/2)*2+(missed?-8:0);
 a.earRight=-Math.sin(phase/2)*2+(missed?-8:0);
 const stroke=left>=right?{color:s.colorLeft,v:left}:{color:s.colorRight,v:right};
 const state=strike>0?stroke.color:jump>0?'comboJump':missed?'miss':happy?'happy':mood;
 return {bodyScaleY:scale,bodyY:bounce-Math.sin(jump*Math.PI)*24,angles:a,blink:time%4100>3970||happy,state,
  drumGlow:{don:stroke.color==='don'?stroke.v:0,ka:stroke.color==='ka'?stroke.v:0}};
}

/** Festival dance for the friends. `energy` 0..1 grows with the gauge. Angles are offsets from each bone's rest angle. */
export function dancerPose(time:number,beat:number,energy:number,mirror:boolean):Pose{
 const hop=Math.abs(Math.sin(beat*Math.PI));
 const land=Math.pow(1-hop,6);
 const swing=Math.sin(beat*Math.PI)*(mirror?-1:1);
 const amp=.55+.45*Math.min(1,Math.max(0,energy));
 const a=zeroAngles();
 // Offsets from the rest angles (±45°) of the raised paws.
 a.armLeft=-18*amp+swing*34*amp;
 a.armRight=18*amp+swing*34*amp;
 a.head=swing*5*amp;
 a.tail=Math.sin(beat*Math.PI*4)*14;
 a.earLeft=-hop*4;a.earRight=hop*4;
 a.backLeft=swing>0?swing*6:0;a.backRight=swing<0?swing*6:0;
 a.scarf=Math.sin(beat*Math.PI*2+.6)*5;
 return {bodyScaleY:1-land*.05,bodyY:-hop*12*amp,angles:a,blink:(time+(mirror?1700:0))%3900>3780,state:'dance',drumGlow:{don:0,ka:0}};
}

/** Stick tip in root space for a given arm rotation (for tests and tuning). */
export function stickTip(arm:'armLeft'|'armRight',angleDeg:number):Point{
 const j=JOINTS[arm],t=j.stickTip;
 const lx=(t[0]-j.attach[0])*j.scale,ly=(t[1]-j.attach[1])*j.scale;
 const r=angleDeg*Math.PI/180;
 return [j.pivot[0]+lx*Math.cos(r)-ly*Math.sin(r),j.pivot[1]+lx*Math.sin(r)+ly*Math.cos(r)];
}
export function drumHeadDistance(p:Point){return ((p[0]-DRUM_HEAD.cx)/DRUM_HEAD.rx)**2+((p[1]-DRUM_HEAD.cy)/DRUM_HEAD.ry)**2;}
