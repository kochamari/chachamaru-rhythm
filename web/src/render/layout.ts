// Logical play-screen layout. Pure: no DOM, no Pixi. Every number here is in
// logical units; the canvas maps them to CSS pixels with a single uniform scale.
//
// Landscape keeps a fixed logical height of 720 and a width that follows the
// screen aspect (960..2000). Portrait keeps a fixed logical width of 720.

export interface Rect {x:number;y:number;w:number;h:number}
export interface PlayLayout {
 W:number;H:number;portrait:boolean;showPads:boolean;
 /** Electronic-drum play in landscape: lane and notes sized to read from a stand. */
 drumMode:boolean;
 /** Scale for text-like sprites (syllables, judgement words). */
 textScale:number;
 /** Festival band across the top: bunting, title plate. */
 band:Rect;
 /** Title plate inside the band (song name, difficulty). */
 title:Rect;
 /** Red lacquer panel (left of the lane in landscape, above it in portrait). */
 panel:Rect;
 /** Dark backing behind the score digits (right-aligned at score.x). */
 scoreBox:Rect;
 score:{x:number;y:number;size:number};
 drum:{x:number;y:number;r:number};
 /** Centre of the difficulty tag. */
 diffTag:{x:number;y:number};
 /** お祭りゲージ above the lane. */
 gauge:Rect;
 lane:Rect;
 laneY:number;hitX:number;laneRight:number;
 noteR:number;largeR:number;judgeR:number;
 /** Syllable strip (ドン・カッ・ド・コ) directly under the lane. */
 syllables:Rect;
 stage:Rect;
 /** Feet position and body height of the main drummer. */
 character:{x:number;y:number;height:number};
 friends:{x:number;y:number;height:number}[];
 /** Where combo balloons appear (near the character's head). */
 balloon:{x:number;y:number};
 /** Touch drum in logical units, or null when pads are hidden. */
 pads:Rect|null;
 /** Song progress strip. */
 progress:Rect;
}

export const TRAVEL_MS=1800;
export const LANDSCAPE_H=720;
export const PORTRAIT_W=720;

export function logicalSize(cssWidth:number,cssHeight:number){
 const w=Math.max(1,cssWidth),h=Math.max(1,cssHeight);
 const portrait=h>w;
 if(portrait){const H=Math.min(2000,Math.max(960,PORTRAIT_W*h/w));return {W:PORTRAIT_W,H,portrait,scale:Math.min(w/PORTRAIT_W,h/H)};}
 const W=Math.min(2000,Math.max(960,LANDSCAPE_H*w/h));
 return {W,H:LANDSCAPE_H,portrait,scale:Math.min(w/W,h/LANDSCAPE_H)};
}

export function computeLayout(W:number,H:number,showPads:boolean,drumMode=false):PlayLayout{
 if(H>W)return portraitLayout(W,H,showPads);
 return drumMode&&!showPads?drumLayout(W,H):landscapeLayout(W,H,showPads);
}

/**
 * Landscape with an electronic drum: the phone sits on a stand an arm's
 * length or more away, so the lane takes most of the height (notes 1.6×),
 * with the score and combo scaled to match and a shorter stage below.
 */
function drumLayout(W:number,H:number):PlayLayout{
 const band={x:0,y:0,w:W,h:58};
 const titleW=Math.min(460,Math.max(280,W*.3));
 const title={x:W-titleW-100,y:4,w:titleW,h:50};
 const blockY=64,panelW=Math.round(Math.min(330,Math.max(270,W*.2)));
 const gauge={x:panelW+6,y:blockY+2,w:W-panelW-18,h:34};
 const lane={x:panelW,y:blockY+44,w:W-panelW,h:232};
 const laneY=lane.y+lane.h/2;
 const hitX=panelW+120;
 const syllables={x:panelW,y:lane.y+lane.h,w:W-panelW,h:40};
 const panel={x:0,y:blockY,w:panelW,h:syllables.y+syllables.h-blockY};
 const stageTop=syllables.y+syllables.h+6;
 const stage={x:0,y:stageTop,w:W,h:H-stageTop};
 const charHeight=Math.min(300,stage.h*.92);
 const feet=stage.y+stage.h-8;
 const character={x:W*.24,y:feet,height:charHeight};
 const friendH=charHeight*.74;
 const left=W*.24+charHeight*.55+friendH*.3,right=W-friendH*.42-18;
 const friends=[0,1,2,3].map(i=>({x:left+(right-left)*i/3,y:feet-(i%2?10:0),height:friendH*(i%2?.9:1)}));
 const drum={x:panelW/2,y:lane.y+lane.h*.52,r:Math.min(92,panelW*.3)};
 return {W,H,portrait:false,showPads:false,drumMode:true,textScale:1.5,band,title,panel,scoreBox:{x:panel.x+10,y:panel.y+8,w:panel.w-20,h:50},score:{x:panelW-18,y:blockY+33,size:42},drum,diffTag:{x:drum.x,y:drum.y+drum.r+18},gauge,lane,laneY,hitX,laneRight:W-26,noteR:48,largeR:66,judgeR:70,syllables,stage,character,friends,balloon:{x:character.x+charHeight*.34,y:feet-charHeight*.98},pads:null,progress:{x:0,y:syllables.y+syllables.h,w:W,h:6}};
}

function landscapeLayout(W:number,H:number,showPads:boolean):PlayLayout{
 const band={x:0,y:0,w:W,h:66};
 const titleW=Math.min(520,Math.max(300,W*.34));
 const title={x:W-titleW-104,y:8,w:titleW,h:50};
 const blockY=74,panelW=Math.round(Math.min(250,Math.max(206,W*.17)));
 const panel={x:0,y:blockY,w:panelW,h:200};
 const gauge={x:panelW+6,y:blockY+2,w:W-panelW-18,h:28};
 const lane={x:panelW,y:blockY+36,w:W-panelW,h:136};
 const laneY=lane.y+lane.h/2;
 const hitX=panelW+86;
 const syllables={x:panelW,y:lane.y+lane.h,w:W-panelW,h:28};
 const stageTop=syllables.y+syllables.h+6;
 const padsH=156;
 const pads=showPads?{x:16,y:H-padsH-10,w:W-32,h:padsH}:null;
 const stageBottom=pads?pads.y-8:H;
 const stage={x:0,y:stageTop,w:W,h:stageBottom-stageTop};
 const charHeight=Math.min(showPads?240:360,stage.h*(showPads?.96:.82));
 const feet=stage.y+stage.h-(showPads?4:26);
 const character={x:W*.3,y:feet,height:charHeight};
 const friendH=charHeight*.74;
 // Spread the friends evenly between the drummer and the right edge.
 const left=W*.3+charHeight*.55+friendH*.3,right=W-friendH*.42-18;
 const friends=[0,1,2,3].map(i=>({x:left+(right-left)*i/3,y:feet-(i%2?12:0),height:friendH*(i%2?.9:1)}));
 const drum={x:panelW/2,y:blockY+112,r:Math.min(58,panelW*.26)};
 return {W,H,portrait:false,showPads,drumMode:false,textScale:1,band,title,panel,scoreBox:{x:panel.x+10,y:panel.y+8,w:panel.w-20,h:40},score:{x:panelW-18,y:blockY+26,size:30},drum,diffTag:{x:drum.x,y:drum.y+drum.r+14},gauge,lane,laneY,hitX,laneRight:W-26,noteR:30,largeR:42,judgeR:44,syllables,stage,character,friends,balloon:{x:character.x+charHeight*.34,y:feet-charHeight*.98},pads,progress:{x:0,y:syllables.y+syllables.h,w:W,h:6}};
}

// Portrait: the score/drum panel sits above a full-width lane so notes get
// the longest possible run on a narrow screen.
function portraitLayout(W:number,H:number,showPads:boolean):PlayLayout{
 const band={x:0,y:0,w:W,h:84};
 const title={x:16,y:10,w:W-128,h:64};
 const panel={x:0,y:90,w:W,h:92};
 const drum={x:62,y:136,r:40};
 const scoreBox={x:120,y:98,w:W-136,h:38};
 const gauge={x:124,y:144,w:W-138,h:26};
 const lane={x:0,y:188,w:W,h:124};
 const laneY=lane.y+lane.h/2;
 const hitX=70;
 const syllables={x:0,y:lane.y+lane.h,w:W,h:28};
 const stageTop=syllables.y+syllables.h+8;
 const padsH=Math.min(300,Math.max(220,H*.2));
 const pads=showPads?{x:12,y:H-padsH-28,w:W-24,h:padsH}:null;
 const stageBottom=pads?pads.y-12:H;
 const stage={x:0,y:stageTop,w:W,h:stageBottom-stageTop};
 const charHeight=Math.min(420,stage.h*.62);
 const feet=stage.y+stage.h*.9;
 const character={x:W*.5,y:feet,height:charHeight};
 const friendH=charHeight*.56;
 const friends=[
  {x:W*.14,y:feet-charHeight*.34,height:friendH*.86},{x:W*.86,y:feet-charHeight*.34,height:friendH*.86},
  {x:W*.2,y:Math.min(stage.y+stage.h-6,feet+charHeight*.08),height:friendH},{x:W*.8,y:Math.min(stage.y+stage.h-6,feet+charHeight*.08),height:friendH},
 ];
 return {W,H,portrait:true,showPads,drumMode:false,textScale:1,band,title,panel,scoreBox,score:{x:W-26,y:117,size:26},drum,diffTag:{x:scoreBox.x+52,y:117},gauge,lane,laneY,hitX,laneRight:W-14,noteR:24,largeR:34,judgeR:36,syllables,stage,character,friends,balloon:{x:W*.5+charHeight*.24,y:feet-charHeight*1.02},pads,progress:{x:0,y:syllables.y+syllables.h,w:W,h:6}};
}

/** x position of a note whose target is targetMs when the visual clock is nowMs. */
export function noteX(layout:Pick<PlayLayout,'hitX'|'laneRight'>,targetMs:number,nowMs:number,travelMs=TRAVEL_MS){
 const speed=(layout.laneRight-layout.hitX)/travelMs;
 return layout.hitX+(targetMs-nowMs)*speed;
}
