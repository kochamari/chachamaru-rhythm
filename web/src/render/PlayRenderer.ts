// The play screen: festival band, lane with notes, drum panel, gauge, stage
// with Chachamaru and friends, and all effects. Reads GameSnapshot and
// EffectEvents; never changes scores or note state.
import {Application,Container,Sprite,Graphics,Text,Texture,TilingSprite,BitmapFont,BitmapText,Assets,Rectangle,FillGradient,type Renderer} from 'pixi.js';
import type {Chart,Manifest,Settings,GameSnapshot,EffectEvent,Note,Tap,Roll,Difficulty,Color} from '../../../contracts/public-types';
import {computeLayout,logicalSize,noteX,TRAVEL_MS,type PlayLayout} from './layout';
import {noteSyllables} from './syllables';
import {beatPhase,downbeatTimes,inSection,friendsForGauge} from './timing';
import {DRUMMER,DANCER,DrummerState,drummerPose,dancerPose,ATLAS_FILES,type Side} from './rig';
import {PixiCharacter,type AtlasTextures} from './PixiCharacter';
import {FRIEND_VARIANTS,recolorAtlas} from './recolor';
import * as art from './art';

const {C}=art;
type Baked=art.Baked;
export const DIFFICULTY_STYLE:Record<Difficulty,{label:string;color:number;stars:number}>={easy:{label:'かんたん',color:0xef8f2f,stars:2},normal:{label:'ふつう',color:0x3f9a55,stars:3},hard:{label:'むずかしい',color:0xd23f47,stars:5}};

export type StageTheme='day'|'evening'|'sunset'|'night';
export interface RendererOptions {chart:Chart;manifest:Manifest;settings:Settings;difficulty:Difficulty;title:string;artist:string;showPads:boolean;tag?:string;inputHint?:'keyboard'|'midi'|'touch';theme?:StageTheme}
/** Stage mood per bundled song; imported songs use the daytime festival. */
export function stageThemeFor(packId:string):StageTheme{return ({'chachamaru-ondo':'evening','yuuyake-shippo':'sunset','hanabi-rush':'night'} as Record<string,StageTheme>)[packId]??'day';}
interface Particle {s:Sprite;vx:number;vy:number;life:number;max:number;spin:number;gravity:number;grow:number;fade:boolean}
interface Flyer {s:Sprite;t0:number;dur:number;x0:number;y0:number;cx:number;cy:number;x1:number;y1:number;scale0:number}
interface Ring {s:Sprite;t0:number;dur:number;scale0:number;scale1:number;alpha:number}
interface Friend {ch:PixiCharacter;joined:number;left:number;active:boolean;mirror:boolean}

const PARTICLE_CAP={standard:160,reduced:40,off:0} as const;

export class PlayRenderer {
 readonly app=new Application();
 readonly metrics={p95:0,quality:'standard'};
 layout!:PlayLayout;
 private scale=1;private alive=true;private initialized=false;
 private readonly world=new Container();
 private readonly stageRoot=new Container();
 private readonly stageBack=new Container();
 private readonly stageChars=new Container();
 private readonly stageFx=new Container();
 private readonly bandRoot=new Container();
 private readonly laneRoot=new Container();
 private readonly laneStatic=new Container();
 private readonly barLayer=new Container();
 private readonly noteLayer=new Container();
 private readonly syllableLayer=new Container();
 private readonly laneFx=new Container();
 private readonly hud=new Container();
 private readonly topFx=new Container();
 private tex!:Record<string,Baked>;
 private atlas!:AtlasTextures;
 private festival!:Texture;
 private drummer!:PixiCharacter;
 private readonly drummerState=new DrummerState();
 private friends:Friend[]=[];
 private notePool:Sprite[]=[];private syllablePool:Sprite[]=[];private barPool:Sprite[]=[];
 private rollBodies:Sprite[]=[];private rollTails:Sprite[]=[];
 private particles:Particle[]=[];private spare:Sprite[]=[];
 private flyers:Flyer[]=[];private rings:Ring[]=[];
 private readonly syllables:Map<string,string>;
 private readonly downbeats:number[];
 private readonly taps:Tap[];
 // Dynamic HUD pieces.
 private scoreText!:BitmapText;private comboText!:BitmapText;private comboLabel!:Text;
 private gaugeFill=new Graphics();private gaugeShine=new Graphics();private gaugeFlower!:Sprite;private gaugeValue=-1;
 private drumHalves:Record<'donleft'|'donright'|'kaleft'|'karight',{s:Sprite;at:number}>={} as never;
 private judgement!:Record<'great'|'ok'|'miss',Sprite>;private judgeAt=-1e9;private judgeKind:'great'|'ok'|'miss'='great';
 private fastLate!:Text;private fastLateAt=-1e9;
 private judgeGlow!:Sprite;private judgeFire!:Sprite;private flames:Sprite[]=[];private goRed=new Graphics();
 private stageBg=new Sprite();private stageMask=new Graphics();private nightTint=new Graphics();private sunburst=new Graphics();
 private themeTint=new Graphics();private stars:{s:Sprite;phase:number}[]=[];private lastFirework=-1;
 private lanterns:{s:Sprite;glow:Sprite;x:number;y:number;phase:number}[]=[];
 private balloon=new Container();private balloonAt=-1e9;private balloonText!:Text;
 private rollBalloon=new Container();private rollText!:Text;private rollCount=0;private rollId='';private rollAt=-1e9;
 private message=new Container();private messageText!:Text;private messageSub!:Text;private messageAt=-1e9;private messageHold=false;
 private hint=new Container();private hintDots:Graphics[]=[];
 private banner=new Container();private bannerAt=-1e9;
 private emblem=new Sprite();private emblemAt=-1e9;
 private progressFill=new Graphics();
 private bandTiles!:TilingSprite;
 private titleRoot=new Container();
 private chorus=false;private chorusChangedAt=-1e9;private chorusMix=0;
 private lastFrame=performance.now();private lastSongTime=-1e9;private upcoming=0;
 private frameSamples:number[]=[];private slowWindows=0;private frameWindowAt=0;private frameWindowStarted=0;
 private resizeObserver:ResizeObserver;
 private lastCombo=0;private comboPopAt=-1e9;private shownScore=-1;private progressBar!:Sprite;private sizeKey='';
 private labels={balloon:'',roll:'',message:'',messageSub:''};private celebration:'allGreat'|'fullCombo'|'clear'|'finish'|null=null;

 constructor(private host:HTMLElement,private opts:RendererOptions){
  this.syllables=noteSyllables(opts.chart.notes,opts.manifest.beatTimesMs);
  this.downbeats=downbeatTimes(opts.manifest.beatTimesMs,opts.manifest.downbeatIndices);
  this.taps=opts.chart.notes.filter((n):n is Tap=>n.kind==='tap');
  this.resizeObserver=new ResizeObserver(()=>this.resize());
 }

 get settings(){return this.opts.settings;}

 async init(){
  await this.app.init({backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio||1,2),autoDensity:true,preference:'webgl',width:this.host.clientWidth||1280,height:this.host.clientHeight||720});
  if(!this.alive){this.app.destroy(true,{children:true});return;}
  this.app.ticker.stop();
  this.app.canvas.className='game-canvas';
  this.host.prepend(this.app.canvas);
  const base=import.meta.env.BASE_URL;
  const [character,arms,festival]=await Promise.all([
   Assets.load<Texture>(base+ATLAS_FILES.character),Assets.load<Texture>(base+ATLAS_FILES.arms),Assets.load<Texture>(base+'original-assets/festival.webp'),
  ]);
  if(!this.alive)return;
  this.atlas={character,arms};this.festival=festival;
  this.bakeTextures();
  this.installFonts();
  this.world.addChild(this.stageRoot,this.bandRoot,this.laneRoot,this.hud,this.topFx);
  this.stageRoot.addChild(this.stageBack,this.stageChars,this.stageFx);
  this.stageRoot.mask=this.stageMask;this.world.addChild(this.stageMask);
  this.laneRoot.addChild(this.laneStatic,this.barLayer,this.noteLayer,this.syllableLayer,this.laneFx);
  this.app.stage.addChild(this.world);
  this.drummer=new PixiCharacter(DRUMMER,this.atlas);
  this.stageChars.addChild(this.drummer.view);
  this.buildPools();
  this.initialized=true;
  this.resize();
  this.resizeObserver.observe(this.host);
  void this.loadFriends();
 }

 // ------------------------------------------------------------ textures --
 private bakeTextures(){
  const r=this.app.renderer as Renderer;
  const b=(c:Container,res=2)=>art.bake(r,c,res);
  this.tex={
   don:b(art.noteGraphic('don',30)),ka:b(art.noteGraphic('ka',30)),
   donL:b(art.noteGraphic('don',42)),kaL:b(art.noteGraphic('ka',42)),
   rollHead:b(art.rollHeadGraphic(30)),rollBody:b(art.rollBodyGraphic(30)),rollTail:b(art.rollTailGraphic(30)),
   ring:b(art.ringGraphic(40,6,0xffffff)),glowGold:b(art.glowGraphic(60,0xffc94d)),glowWhite:b(art.glowGraphic(60,0xffffff)),
   glowRed:b(art.glowGraphic(60,0xff6a3d)),glowCyan:b(art.glowGraphic(60,0x5fe0ff)),
   spark:b(art.sparkGraphic(9,0xffffff)),dot:b(art.dotGraphic(5,0xffffff)),petal:b(art.petalGraphic(9,0xffcc33)),
   flame:b(art.flameGraphic(46)),sunflower:b(art.sunflowerGraphic(40)),sunflowerSmall:b(art.sunflowerGraphic(18)),
   drum:b(art.drumGraphic(64)),
   donleft:b(art.drumHalfGraphic(64,'skin','left',0xff5a36)),donright:b(art.drumHalfGraphic(64,'skin','right',0xff5a36)),
   kaleft:b(art.drumHalfGraphic(64,'rim','left',0x39d2f2)),karight:b(art.drumHalfGraphic(64,'rim','right',0x39d2f2)),
   great:b(art.judgementGraphic('great')),ok:b(art.judgementGraphic('ok')),miss:b(art.judgementGraphic('miss')),
   lantern:b(lanternGraphic()),confetti:b(new Graphics().rect(-5,-3,10,6).fill(0xffffff)),
  };
  for(const text of new Set(this.syllables.values())){
   this.tex['syl:'+text]=b(new Text({text,style:{fontFamily:art.FONT,fontSize:text.length>2?17:19,fontWeight:'900',fill:C.ink,letterSpacing:1}}));
  }
 }
 private installFonts(){
  const chars=[['0','9'],',',' '];
  // Bitmap fonts live in Pixi's global cache; each session installs its own
  // copy and uninstalls it in dispose() (textures belong to that renderer).
  BitmapFont.install({name:'ChachaScore',style:{fontFamily:art.FONT,fontSize:34,fontWeight:'900',fill:0xffffff,stroke:{color:C.ink,width:7,join:'round'}},chars,resolution:2,padding:4});
  BitmapFont.install({name:'ChachaCombo',style:{fontFamily:art.FONT,fontSize:56,fontWeight:'900',fill:0xffffff,stroke:{color:C.ink,width:9,join:'round'}},chars,resolution:2,padding:6});
 }
 private sprite(key:string){const t=this.tex[key];const s=new Sprite(t.texture);s.anchor.set(t.anchorX,t.anchorY);return s;}

 private buildPools(){
  for(let i=0;i<80;i++){const s=new Sprite();s.visible=false;this.notePool.push(s);this.noteLayer.addChild(s);}
  for(let i=0;i<8;i++){const body=this.sprite('rollBody'),tail=this.sprite('rollTail');body.visible=tail.visible=false;this.rollBodies.push(body);this.rollTails.push(tail);this.noteLayer.addChildAt(tail,0);this.noteLayer.addChildAt(body,0);}
  for(let i=0;i<80;i++){const s=new Sprite();s.visible=false;this.syllablePool.push(s);this.syllableLayer.addChild(s);}
  for(let i=0;i<16;i++){const s=new Sprite(Texture.WHITE);s.visible=false;s.alpha=.22;this.barPool.push(s);this.barLayer.addChild(s);}
  this.judgement={great:this.sprite('great'),ok:this.sprite('ok'),miss:this.sprite('miss')};
  for(const s of Object.values(this.judgement)){s.visible=false;this.laneFx.addChild(s);}
  this.fastLate=new Text({text:'',style:{fontFamily:art.FONT,fontSize:15,fontWeight:'800',fill:0xfff2ce,stroke:{color:C.ink,width:4}}});this.fastLate.anchor.set(.5);this.laneFx.addChild(this.fastLate);
  const cap=PARTICLE_CAP[this.settings.effects];
  for(let i=0;i<Math.max(cap,24)+24;i++){const s=new Sprite();s.anchor.set(.5);s.visible=false;this.spare.push(s);}
 }

 private async loadFriends(){
  try{
   const img=this.atlas.character.source.resource as CanvasImageSource&{width:number;height:number};
   for(const [i,variant] of FRIEND_VARIANTS.entries()){
    const canvas=await recolorAtlas(img,variant,'chachamaru-anime-v1',.5);
    if(!this.alive)return;
    const texture=canvas?Texture.from(canvas):this.atlas.character;
    const ch=new PixiCharacter(DANCER,{character:texture,arms:this.atlas.arms},{showFlower:false,scales:{character:canvas?.5:1}});
    ch.view.visible=false;ch.view.alpha=0;
    this.friends.push({ch,joined:-1e9,left:-1e9,active:false,mirror:i%2===1});
    this.stageChars.addChildAt(ch.view,0);
   }
   this.placeCharacters();
  }catch{/* Friends are decoration; the game plays without them. */}
 }

 // --------------------------------------------------------------- layout --
 resize(){
  if(!this.initialized)return;
  const cs=getComputedStyle(this.host);
  const pl=parseFloat(cs.paddingLeft)||0,pr=parseFloat(cs.paddingRight)||0,pt=parseFloat(cs.paddingTop)||0,pb=parseFloat(cs.paddingBottom)||0;
  const fullW=this.host.clientWidth||1,fullH=this.host.clientHeight||1;
  // The observer also fires right after start-up: skip when nothing changed.
  const key=[fullW,fullH,pl,pr,pt,pb,this.opts.showPads,this.opts.inputHint,this.app.renderer.resolution].join();
  if(key===this.sizeKey)return;
  this.sizeKey=key;
  const w=Math.max(1,fullW-pl-pr),h=Math.max(1,fullH-pt-pb);
  const size=logicalSize(w,h);
  this.layout=computeLayout(size.W,size.H,this.opts.showPads);
  this.scale=size.scale;
  this.app.renderer.resize(fullW,fullH);
  const left=pl+(w-size.W*size.scale)/2,top=pt+(h-size.H*size.scale)/2;
  this.world.scale.set(size.scale);
  this.world.position.set(left,top);
  const css:Record<string,string>={'--play-scale':String(size.scale),'--play-left':`${left}px`,'--play-top':`${top}px`,'--play-right':`${fullW-left-size.W*size.scale}px`};
  const p=this.layout.pads;
  if(p)Object.assign(css,{'--pads-x':`${p.x*size.scale}px`,'--pads-y':`${p.y*size.scale}px`,'--pads-w':`${p.w*size.scale}px`,'--pads-h':`${p.h*size.scale}px`});
  for(const [k,v] of Object.entries(css))this.host.style.setProperty(k,v);
  this.host.classList.toggle('is-portrait',this.layout.portrait);
  this.buildStatic();
  this.placeCharacters();
 }
 setPadsVisible(show:boolean){if(this.opts.showPads===show)return;this.opts.showPads=show;this.resize();}
 setInputHint(mode:'keyboard'|'midi'|'touch'){this.opts.inputHint=mode;if(this.initialized)this.buildHint();}

 private buildStatic(){
  const L=this.layout;
  for(const c of [this.stageBack,this.bandRoot,this.laneStatic,this.hud])c.removeChildren().forEach(x=>{if(x!==this.stageBg&&x!==this.nightTint&&x!==this.themeTint&&x!==this.sunburst&&x!==this.goRed&&x!==this.gaugeFill&&x!==this.gaugeShine&&x!==this.progressFill&&!this.lanterns.some(l=>l.s===x||l.glow===x))x.destroy({children:true});});
  this.lanterns=[];
  // Stage background: cover the stage rectangle with the festival scene.
  const st=L.stage;
  this.stageMask.clear().rect(st.x,st.y,st.w,st.h).fill(0xffffff);
  this.stageBg.texture=this.festival;
  const cover=Math.max(st.w/this.festival.width,st.h/this.festival.height);
  this.stageBg.scale.set(cover);this.stageBg.anchor.set(.5,.62);
  this.stageBg.position.set(st.x+st.w/2,st.y+st.h*.62);
  this.stageBack.addChild(this.stageBg);
  // Chorus: an evening-festival sky and warm rays that fade with distance.
  this.nightTint.clear().rect(st.x,st.y,st.w,st.h).fill(new FillGradient({type:'linear',start:{x:0,y:st.y},end:{x:0,y:st.y+st.h},textureSpace:'global',colorStops:[{offset:0,color:'rgba(52,18,86,0.72)'},{offset:.45,color:'rgba(150,40,70,0.34)'},{offset:1,color:'rgba(255,120,60,0.06)'}]}));
  this.nightTint.alpha=0;
  this.sunburst.clear();
  const rays=24,R=Math.hypot(st.w,st.h)*.75;
  const rayFill=new FillGradient({type:'radial',center:{x:0,y:0},innerRadius:0,outerCenter:{x:0,y:0},outerRadius:R,textureSpace:'global',colorStops:[{offset:0,color:'rgba(255,230,140,0.75)'},{offset:.35,color:'rgba(255,170,70,0.32)'},{offset:1,color:'rgba(255,120,60,0)'}]});
  for(let i=0;i<rays;i++){const a0=i/rays*Math.PI*2,a1=(i+.5)/rays*Math.PI*2;this.sunburst.poly([0,0,Math.cos(a0)*R,Math.sin(a0)*R,Math.cos(a1)*R,Math.sin(a1)*R]).fill(rayFill);}
  this.sunburst.position.set(L.character.x,L.character.y-L.character.height*.62);this.sunburst.alpha=0;this.sunburst.blendMode='add';
  const shade=new Graphics().rect(st.x,st.y,st.w,28).fill({color:0x140c14,alpha:.45}).rect(st.x,st.y+28,st.w,24).fill({color:0x140c14,alpha:.18});
  // Per-song time of day.
  const theme=this.opts.theme??'day';
  const tints:Record<StageTheme,string[]>={day:['rgba(0,0,0,0)','rgba(0,0,0,0)','rgba(0,0,0,0)'],evening:['rgba(40,22,90,0.55)','rgba(120,50,110,0.28)','rgba(255,140,80,0.08)'],sunset:['rgba(255,110,60,0.32)','rgba(255,150,90,0.22)','rgba(255,190,120,0.12)'],night:['rgba(6,10,40,0.82)','rgba(14,20,60,0.62)','rgba(30,24,60,0.34)']};
  const t=tints[theme];
  this.themeTint.clear().rect(st.x,st.y,st.w,st.h).fill(new FillGradient({type:'linear',start:{x:0,y:st.y},end:{x:0,y:st.y+st.h},textureSpace:'global',colorStops:[{offset:0,color:t[0]},{offset:.5,color:t[1]},{offset:1,color:t[2]}]}));
  for(const star of this.stars)star.s.destroy();this.stars=[];
  this.stageBack.addChild(this.themeTint);
  if(theme==='night'){
   let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
   for(let i=0;i<46;i++){const star=this.sprite('dot');star.position.set(st.x+rnd()*st.w,st.y+rnd()*st.h*.42);star.scale.set(.25+rnd()*.45);star.tint=rnd()>.8?0xffe9a8:0xffffff;this.stars.push({s:star,phase:rnd()*6.28});this.stageBack.addChild(star);}
  }
  this.stageBack.addChild(this.nightTint,this.sunburst,shade);
  this.buildLanterns();
  this.buildBand();
  this.buildLane();
  this.buildHint();
 }

 private buildLanterns(){
  const L=this.layout,st=L.stage;
  const count=Math.max(5,Math.round(st.w/170));
  const rope=new Graphics();
  const y0=st.y+18,sag=26;
  rope.moveTo(st.x-10,y0);
  for(let i=0;i<=40;i++){const t=i/40;rope.lineTo(st.x-10+t*(st.w+20),y0+Math.sin(t*Math.PI*count)*-4+sag*Math.sin(t*Math.PI));}
  rope.stroke({color:0x2b1b12,width:2,alpha:.8});
  this.stageBack.addChild(rope);
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,x=st.x+t*st.w,y=y0+sag*Math.sin(t*Math.PI)+6;
   const glow=this.sprite('glowGold');glow.blendMode='add';glow.scale.set(1.3);glow.alpha=0;glow.position.set(x,y+22);
   const s=this.sprite('lantern');s.anchor.set(.5,0);s.scale.set(L.portrait?.8:.72);s.position.set(x,y);
   this.stageBack.addChild(glow,s);
   this.lanterns.push({s,glow,x,y,phase:i*1.7});
  }
 }

 private buildBand(){
  const L=this.layout,band=L.band;
  const pattern=art.bannerPattern(260,band.h);
  const pat=(this.app.renderer as Renderer).generateTexture({target:pattern,resolution:1,frame:new Rectangle(0,0,260,band.h)});pattern.destroy({children:true});
  this.bandTiles=new TilingSprite({texture:pat,width:band.w,height:band.h});
  const g=new Graphics();
  g.rect(0,band.h-6,band.w,6).fill(C.lacquerDark);
  g.rect(0,band.h-8,band.w,2).fill({color:C.gold,alpha:.9});
  // Bunting flags hanging from the lower trim of the band.
  const colors=[0xfff2ce,0x467843,0xffd86b,0x2cbbd5];
  for(let x=10,i=0;x<band.w;x+=34,i++){g.poly([x,band.h-8,x+26,band.h-8,x+13,band.h+8]).fill(colors[i%colors.length]).stroke({color:C.ink,width:1.5,alpha:.5});}
  this.bandRoot.addChild(this.bandTiles,g);
  // Medallions: sunflowers drifting along the band.
  const medals=new Container();
  for(let x=60;x<band.w+120;x+=210){const f=this.sprite('sunflower');f.scale.set(.5);f.position.set(x,band.h*.43);f.alpha=.9;medals.addChild(f);}
  medals.label='medals';
  this.bandRoot.addChild(medals);
  this.buildTitle();
 }

 private buildTitle(){
  const L=this.layout,t=L.title,d=DIFFICULTY_STYLE[this.opts.difficulty];
  this.titleRoot.destroy({children:true});this.titleRoot=new Container();
  const g=new Graphics();
  g.roundRect(t.x,t.y,t.w,t.h,t.h/2).fill({color:0x1c1420,alpha:.9}).stroke({color:C.gold,width:2.5});
  const badgeW=L.portrait?118:126,badgeH=L.portrait?30:28;
  const bx=t.x+t.w-badgeW-10,by=t.y+(L.portrait?10:(t.h-badgeH)/2);
  g.roundRect(bx,by,badgeW,badgeH,badgeH/2).fill(d.color).stroke({color:0xffffff,width:2,alpha:.8});
  this.titleRoot.addChild(g);
  const title=new Text({text:this.opts.title,style:{fontFamily:art.FONT,fontSize:L.portrait?26:23,fontWeight:'900',fill:0xffffff,stroke:{color:C.ink,width:4}}});
  const maxW=t.w-badgeW-(L.portrait?40:44);
  title.position.set(t.x+22,t.y+(L.portrait?8:5));
  if(title.width>maxW)title.scale.set(maxW/title.width);
  const artist=new Text({text:this.opts.artist+(this.opts.tag?`　［${this.opts.tag}］`:''),style:{fontFamily:art.FONT,fontSize:L.portrait?15:13,fontWeight:'700',fill:0xf3dfb0}});
  artist.position.set(t.x+23,t.y+(L.portrait?42:31));
  if(artist.width>maxW)artist.scale.set(maxW/artist.width);
  const badge=new Text({text:`${d.label}  ${'★'.repeat(d.stars)}`,style:{fontFamily:art.FONT,fontSize:13,fontWeight:'900',fill:0xffffff,stroke:{color:0x000000,width:3}}});
  badge.anchor.set(.5);badge.position.set(bx+badgeW/2,by+badgeH/2);
  if(badge.width>badgeW-12)badge.scale.set((badgeW-12)/badge.width);
  this.titleRoot.addChild(title,artist,badge);
  this.bandRoot.addChild(this.titleRoot);
 }

 private buildLane(){
  const L=this.layout,{lane,panel,gauge}=L;
  const g=new Graphics();
  // Left panel: red lacquer with a gold frame.
  g.roundRect(panel.x-20,panel.y,panel.w+(L.portrait?40:20),panel.h,18).fill(C.lacquer).stroke({color:C.gold,width:3});
  for(let i=0;i<Math.ceil(panel.h/28)+1;i++)g.moveTo(panel.x,panel.y+20+i*28).lineTo(panel.x+panel.w,panel.y+6+i*28).stroke({color:0xffffff,width:1,alpha:.06});
  g.roundRect(L.scoreBox.x,L.scoreBox.y,L.scoreBox.w,L.scoreBox.h,12).fill({color:0x2a0d0d,alpha:.45});
  // Lane body.
  g.rect(lane.x,lane.y,lane.w,lane.h).fill(C.lane);
  g.rect(lane.x,lane.y,lane.w,lane.h*.5).fill({color:0xffffff,alpha:.025});
  g.rect(lane.x,lane.y-3,lane.w,3).fill(C.cream);g.rect(lane.x,lane.y+lane.h,lane.w,3).fill(C.cream);
  g.rect(lane.x,lane.y-5,lane.w,2).fill(C.ink);g.rect(lane.x,lane.y+lane.h+3,lane.w,2).fill(C.ink);
  this.laneStatic.addChild(g);
  // Chorus colouring of the lane (fades in).
  this.goRed.clear().rect(lane.x,lane.y,lane.w,lane.h).fill({color:0x8a1d3a,alpha:.75});
  this.goRed.alpha=0;this.laneStatic.addChild(this.goRed);
  // Hit zone.
  const hz=new Graphics();
  hz.rect(L.hitX-L.judgeR-6,lane.y,L.judgeR*2+12,lane.h).fill({color:0xffffff,alpha:.05});
  this.laneStatic.addChild(hz);
  this.judgeGlow=this.sprite('glowWhite');this.judgeGlow.position.set(L.hitX,L.laneY);this.judgeGlow.alpha=0;this.judgeGlow.blendMode='add';this.judgeGlow.scale.set(1.2);
  this.laneStatic.addChild(this.judgeGlow);
  const jc=new Graphics();
  jc.circle(L.hitX,L.laneY,L.judgeR+3).stroke({color:C.ink,width:3,alpha:.6});
  jc.circle(L.hitX,L.laneY,L.judgeR).stroke({color:0xd9d2c4,width:4});
  jc.circle(L.hitX,L.laneY,L.judgeR*.7).fill({color:0x000000,alpha:.25}).stroke({color:0x8f8a86,width:3});
  this.laneStatic.addChild(jc);
  this.flames=[];
  this.judgeFire=this.sprite('glowRed');this.judgeFire.position.set(L.hitX,L.laneY);this.judgeFire.scale.set(1.35);this.judgeFire.blendMode='add';this.judgeFire.alpha=0;
  this.laneStatic.addChildAt(this.judgeFire,this.laneStatic.getChildIndex(jc));
  for(let i=0;i<7;i++){const f=this.sprite('flame');f.anchor.set(.5,1);f.blendMode='add';f.alpha=0;this.flames.push(f);this.laneStatic.addChild(f);}
  // Syllable strip.
  const syl=new Graphics();
  syl.rect(L.syllables.x,L.syllables.y+3,L.syllables.w,L.syllables.h-3).fill(0xf4ead3);
  syl.rect(L.syllables.x,L.syllables.y+L.syllables.h-2,L.syllables.w,2).fill({color:C.ink,alpha:.5});
  this.laneStatic.addChild(syl);
  // Progress strip: a dark track and a gold bar scaled each frame.
  this.progressFill.clear().rect(L.progress.x,L.progress.y,L.progress.w,L.progress.h).fill({color:0x1a1418,alpha:.85});
  this.progressBar=new Sprite(Texture.WHITE);this.progressBar.tint=C.gold;this.progressBar.position.set(L.progress.x,L.progress.y+1);this.progressBar.height=L.progress.h-2;this.progressBar.width=0;
  this.laneStatic.addChild(this.progressFill,this.progressBar);
  // Notes are clipped to the lane (they vanish under the panel).
  const clip=new Graphics().rect(lane.x,lane.y-50,lane.w,lane.h+100).fill(0xffffff);
  this.laneStatic.addChild(clip);this.noteLayer.mask=clip;
  const sylClip=new Graphics().rect(L.syllables.x,L.syllables.y,L.syllables.w,L.syllables.h).fill(0xffffff);
  this.laneStatic.addChild(sylClip);this.syllableLayer.mask=sylClip;
  const barClip=new Graphics().rect(lane.x,lane.y,lane.w,lane.h).fill(0xffffff);
  this.laneStatic.addChild(barClip);this.barLayer.mask=barClip;
  for(const s of this.barPool){s.width=2;s.height=lane.h;}
  // Gauge frame.
  const gf=new Graphics();
  gf.roundRect(gauge.x,gauge.y,gauge.w,gauge.h,gauge.h/2).fill(0x1a1418).stroke({color:C.ink,width:3});
  this.laneStatic.addChild(gf,this.gaugeFill,this.gaugeShine);
  const clearX=gauge.x+4+(gauge.w-gauge.h*1.6-8)*.7;
  const mark=new Graphics().rect(clearX-1.5,gauge.y+3,3,gauge.h-6).fill(0xffffff);
  const clearLabel=new Text({text:'クリア',style:{fontFamily:art.FONT,fontSize:13,fontWeight:'900',fill:0xffffff,stroke:{color:C.ink,width:4}}});
  clearLabel.anchor.set(0,.5);clearLabel.position.set(clearX+6,gauge.y+gauge.h/2);
  this.laneStatic.addChild(mark,clearLabel);
  this.gaugeFlower=this.sprite('sunflower');this.gaugeFlower.position.set(gauge.x+gauge.w-gauge.h*.72,gauge.y+gauge.h/2);this.gaugeFlower.scale.set(.5);
  this.laneStatic.addChild(this.gaugeFlower);
  this.gaugeValue=-1;
  // Drum, score and combo (HUD).
  const drum=this.sprite('drum');drum.position.set(L.drum.x,L.drum.y);drum.scale.set(L.drum.r/64);
  this.hud.addChild(drum);
  for(const key of ['donleft','donright','kaleft','karight'] as const){const s=this.sprite(key);s.position.set(L.drum.x,L.drum.y);s.scale.set(L.drum.r/64);s.alpha=0;s.blendMode='add';this.hud.addChild(s);this.drumHalves[key]={s,at:-1e9};}
  this.shownScore=-1;
  this.scoreText=new BitmapText({text:'0',style:{fontFamily:'ChachaScore',fontSize:L.score.size}});
  this.scoreText.anchor.set(1,.5);this.scoreText.position.set(L.score.x,L.score.y+6);
  this.comboText=new BitmapText({text:'',style:{fontFamily:'ChachaCombo',fontSize:L.drum.r*.78}});
  this.comboText.anchor.set(.5);this.comboText.position.set(L.drum.x,L.drum.y-L.drum.r*.14);
  this.comboLabel=new Text({text:'コンボ',style:{fontFamily:art.FONT,fontSize:13,fontWeight:'900',fill:0xffffff,stroke:{color:C.ink,width:4}}});
  this.comboLabel.anchor.set(.5);this.comboLabel.position.set(L.drum.x,L.drum.y+L.drum.r*.5);this.comboLabel.visible=false;
  const diff=DIFFICULTY_STYLE[this.opts.difficulty];
  const tag=new Text({text:diff.label,style:{fontFamily:art.FONT,fontSize:13,fontWeight:'900',fill:0xffffff,stroke:{color:C.ink,width:4}}});
  tag.anchor.set(.5);tag.position.set(L.diffTag.x,L.diffTag.y);
  const tagBg=new Graphics().roundRect(L.diffTag.x-tag.width/2-10,L.diffTag.y-11,tag.width+20,22,11).fill(diff.color).stroke({color:0xffffff,width:1.5,alpha:.7});
  this.hud.addChild(this.scoreText,this.comboText,this.comboLabel,tagBg,tag);
  // Balloons and messages live in HUD/stage layers.
  this.buildBalloons();
 }

 private buildBalloons(){
  const L=this.layout;
  this.balloon.destroy({children:true});this.balloon=new Container();
  const bg=new Graphics();
  bg.roundRect(-96,-34,192,58,29).fill(0xfffbef).stroke({color:C.ink,width:3});
  bg.poly([-30,22,-12,22,-40,44]).fill(0xfffbef).stroke({color:C.ink,width:3});
  bg.rect(-31,19,20,6).fill(0xfffbef);
  this.balloonText=new Text({text:'',style:{fontFamily:art.FONT,fontSize:25,fontWeight:'900',fill:C.donDark,stroke:{color:0xffffff,width:3}}});
  this.balloonText.anchor.set(.5);this.balloonText.position.set(0,-5);
  this.balloonText.text=this.labels.balloon;
  this.balloon.addChild(bg,this.balloonText);this.balloon.position.set(L.balloon.x+96,L.balloon.y-10);this.balloon.visible=false;
  this.stageFx.addChild(this.balloon);
  this.rollBalloon.destroy({children:true});this.rollBalloon=new Container();
  const burst=new Graphics().poly(art.burstPoints(58)).fill(0xffd84a).stroke({color:C.ink,width:3});
  this.rollText=new Text({text:'',style:{fontFamily:art.FONT,fontSize:30,fontWeight:'900',fill:C.ink,stroke:{color:0xffffff,width:4},align:'center'}});
  this.rollText.anchor.set(.5);this.rollText.text=this.labels.roll;
  this.rollBalloon.addChild(burst,this.rollText);
  this.rollBalloon.position.set(L.hitX+(L.portrait?150:40),L.lane.y-(L.portrait?30:14));this.rollBalloon.visible=false;
  this.topFx.addChild(this.rollBalloon);
  this.message.destroy({children:true});this.message=new Container();
  this.messageText=new Text({text:'',style:{fontFamily:art.FONT,fontSize:L.portrait?64:56,fontWeight:'900',fill:0xffffff,stroke:{color:C.ink,width:8,join:'round'},align:'center'}});
  this.messageSub=new Text({text:'',style:{fontFamily:art.FONT,fontSize:L.portrait?22:19,fontWeight:'800',fill:0xfff2ce,stroke:{color:C.ink,width:5},align:'center'}});
  this.messageText.anchor.set(.5);this.messageSub.anchor.set(.5);this.messageSub.y=L.portrait?56:46;
  this.messageText.text=this.labels.message;this.messageSub.text=this.labels.messageSub;
  this.message.addChild(this.messageText,this.messageSub);
  this.message.position.set(L.portrait?L.W/2:L.W*.66,L.stage.y+L.stage.h*(L.portrait?.28:.42));this.message.visible=false;
  this.stageFx.addChild(this.message);
  this.banner.destroy({children:true});this.banner=new Container();this.banner.visible=false;this.topFx.addChild(this.banner);
  if(this.celebration)this.drawBanner(this.celebration);
  this.emblem.destroy();this.emblem=this.sprite('sunflower');this.emblem.visible=false;this.stageFx.addChild(this.emblem);
 }

 private buildHint(){
  this.hint.destroy({children:true});this.hint=new Container();this.hintDots=[];
  const mode=this.opts.inputHint;
  if(!this.layout||mode==='touch'||!mode){return;}
  const L=this.layout;
  const labels=mode==='midi'?['スネア ＝ ドン','フロアタム ＝ カッ']:['F・J ＝ ドン','D・K ＝ カッ'];
  const g=new Graphics();const w=mode==='midi'?360:260,h=38;
  g.roundRect(0,0,w,h,19).fill({color:0x1c1420,alpha:.78}).stroke({color:C.gold,width:1.5,alpha:.8});
  this.hint.addChild(g);
  labels.forEach((label,i)=>{
   const dot=new Graphics().circle(0,0,8).fill(i?C.ka:C.don).stroke({color:0xffffff,width:2});
   dot.position.set(20+i*w/2,h/2);dot.alpha=.55;this.hintDots.push(dot);
   const t=new Text({text:label,style:{fontFamily:art.FONT,fontSize:14,fontWeight:'800',fill:0xffffff}});t.anchor.set(0,.5);t.position.set(34+i*w/2,h/2);
   this.hint.addChild(dot,t);
  });
  this.hint.position.set(L.W-w-18,L.stage.y+L.stage.h-h-14);
  this.stageFx.addChild(this.hint);
 }

 private placeCharacters(){
  if(!this.layout||!this.drummer)return;
  const L=this.layout;
  this.drummer.place(L.character.x,L.character.y,L.character.height);
  this.friends.forEach((f,i)=>{const p=L.friends[i];if(p)f.ch.place(p.x,p.y,p.height,f.mirror);});
 }

 // ----------------------------------------------------------------- input --
 /** Immediate feedback for any input, before judgement. */
 hit(color:Color,time:number,side?:Side){
  if(!this.initialized)return;
  const now=performance.now();
  const s=side??(color==='don'?'left':'right');
  const key=`${color}${s}` as 'donleft';
  if(this.drumHalves[key])this.drumHalves[key].at=now;
  this.drummerState.hit(color,time,side);
  const dot=this.hintDots[color==='don'?0:1];if(dot)dot.alpha=1;
 }

 // ----------------------------------------------------------------- frame --
 draw(time:number,s:GameSnapshot,events:readonly EffectEvent[]=[]){
  if(!this.initialized)return;
  const now=performance.now(),dt=Math.min(50,Math.max(0,now-this.lastFrame));this.lastFrame=now;
  const visible=time+this.settings.visualAdvanceMs;
  const beat=beatPhase(this.opts.manifest.beatTimesMs,time);
  const chorus=this.settings.festival&&inSection(this.opts.manifest.sections,'chorus',time);
  if(chorus!==this.chorus){this.chorus=chorus;this.chorusChangedAt=now;if(chorus)this.onChorusStart();}
  this.chorusMix+=((chorus?1:0)-this.chorusMix)*Math.min(1,dt/(chorus?260:330));
  this.host.classList.toggle('chorus',chorus);
  this.host.classList.toggle('has-combo',s.combo>=100);
  for(const e of events)this.onEvent(e,time,now,s);
  this.drawBand(now,beat);
  this.drawStage(now,time,beat,s);
  this.drawLane(visible,now,beat,s);
  this.drawHud(now,s,time);
  this.stepEffects(now,dt);
  this.app.render();
  this.trackFrames(now);
 }

 private drawBand(now:number,beat:number){
  this.bandTiles.tilePosition.x=-(now*.02)%260;
  const medals=this.bandRoot.getChildByLabel('medals');
  if(medals){medals.x=-((now*.02)%210);for(const [i,m] of medals.children.entries())m.rotation=Math.sin(beat*Math.PI+i)*.08;}
 }

 private drawStage(now:number,time:number,beat:number,s:GameSnapshot){
  const L=this.layout,mix=this.chorusMix;
  this.nightTint.alpha=mix;
  this.sunburst.alpha=mix*.85;this.sunburst.rotation=now*.00006;
  const theme=this.opts.theme??'day';
  const lit=theme==='night'||theme==='evening'?.55:0;
  for(const l of this.lanterns){
   const sway=Math.sin(beat*Math.PI+l.phase)*.05;
   l.s.rotation=sway;
   const pulse=.75+.25*Math.max(0,Math.cos(beat*Math.PI*2));
   l.glow.alpha=Math.min(1,.18+lit+mix*.72)*pulse;
   l.s.tint=mix>.05||lit?0xffffff:0xe8d8c8;
  }
  for(const star of this.stars)star.s.alpha=.45+.55*Math.abs(Math.sin(now*.0012+star.phase));
  // Night songs: fireworks every two bars (every bar in the chorus).
  if(theme==='night'&&this.settings.effects!=='off'&&time>0){
   const every=this.chorus?4:8,slot=Math.floor(beat/every);
   if(slot!==this.lastFirework&&beat>=0){this.lastFirework=slot;const st=L.stage;const r=((slot*9301+49297)%233280)/233280;this.firework(st.x+st.w*(.45+.5*r),st.y+st.h*(.14+.2*((slot*7)%5)/5));}
  }
  // Main drummer.
  const missAge=time-this.drummerState.missAt;
  const mood=this.chorus?'chorusDance':'idle';
  const pose=drummerPose(this.drummerState,time,beat,mood);
  this.drummer.apply(pose);
  void missAge;
  // Friends join at festival-gauge steps and dance on the beat.
  const want=friendsForGauge(s.gauge);
  this.friends.forEach((f,i)=>{
   const active=i<want;
   if(active&&!f.active){f.active=true;f.joined=now;f.ch.view.visible=true;}
   if(!active&&f.active){f.active=false;f.left=now;}
   const p=L.friends[i];if(!p)return;
   if(f.active){
    const k=Math.min(1,(now-f.joined)/420);
    const pop=k<1?1+Math.sin(k*Math.PI)*.18:1;
    f.ch.view.alpha=Math.min(1,k*2);
    f.ch.place(p.x,p.y-Math.sin(k*Math.PI)*30*(1-k),p.height*pop,f.mirror);
    f.ch.apply(dancerPose(time,beat,.5+mix*.5,f.mirror));
   }else if(f.ch.view.visible){
    const k=Math.min(1,(now-f.left)/360);
    f.ch.view.alpha=1-k;f.ch.place(p.x+(f.mirror?1:-1)*k*40,p.y-Math.sin(k*Math.PI)*40,p.height,f.mirror);
    if(k>=1)f.ch.view.visible=false;
   }
  });
  // Balloon from Chachamaru.
  const bAge=now-this.balloonAt;
  this.balloon.visible=bAge<1100;
  if(this.balloon.visible){const k=Math.min(1,bAge/140);this.balloon.scale.set(.6+.4*easeOutBack(k));this.balloon.alpha=bAge>900?1-(bAge-900)/200:1;}
  // Gold emblem for every 100 combo.
  const eAge=now-this.emblemAt;
  this.emblem.visible=eAge<900;
  if(this.emblem.visible){const k=eAge/900;this.emblem.scale.set(.4+1.4*easeOutBack(Math.min(1,k*2.2)));this.emblem.alpha=k>.6?1-(k-.6)/.4:1;this.emblem.rotation=k*1.2;this.emblem.position.set(L.character.x,L.character.y-L.character.height*.9);}
  // Messages (count-in).
  const mAge=now-this.messageAt;
  this.message.visible=this.messageHold||mAge<1200;
  if(this.message.visible){const k=Math.min(1,mAge/160);this.message.scale.set(.7+.3*easeOutBack(k));this.message.alpha=this.messageHold?1:mAge>900?1-(mAge-900)/300:1;}
  for(const d of this.hintDots)d.alpha=Math.max(.55,d.alpha-.05);
  // Celebration banner.
  const cAge=now-this.bannerAt;
  this.banner.visible=cAge<3200;
  if(this.banner.visible){const k=Math.min(1,cAge/380);this.banner.scale.set(.5+.5*easeOutBack(k));this.banner.alpha=cAge>2800?1-(cAge-2800)/400:1;}
 }

 private drawLane(visible:number,now:number,beat:number,s:GameSnapshot){
  const L=this.layout,notes=this.opts.chart.notes,offset=this.opts.chart.offsetMs;
  // Faster scroll spreads dense notes further apart; judgement is unchanged.
  const travel=TRAVEL_MS/(this.settings.scrollSpeed??1);
  const mix=this.chorusMix;
  this.goRed.alpha=mix;
  // Festival flames rise from the judge circle during the chorus.
  this.flames.forEach((f,i)=>{
   const n=this.flames.length,u=i/(n-1);
   const a=Math.PI*(1.12+.76*u);
   const flick=.82+.18*Math.sin(now*.021+i*2.3)+.08*Math.sin(now*.047+i);
   f.position.set(L.hitX+Math.cos(a)*L.judgeR*.78,L.laneY+Math.sin(a)*L.judgeR*.78+10);
   f.rotation=(u-.5)*.7+Math.sin(now*.006+i)*.08;
   const tall=1-Math.abs(u-.5)*.9;
   f.scale.set(.62*flick,(.55+.75*tall)*flick);
   f.alpha=mix*.95;
  });
  this.judgeFire.alpha=mix*(.55+.15*Math.sin(now*.012));
  // Walk back if time moved backwards (retry, seek).
  if(visible<this.lastSongTime)this.upcoming=0;
  this.lastSongTime=visible;
  while(this.upcoming<notes.length){const n=notes[this.upcoming];const end=(n.kind==='roll'?n.endMs:n.timeMs)+offset;if(end>=visible-400)break;this.upcoming++;}
  // Bar lines.
  let bi=0;
  for(const t of this.downbeats){
   const x=noteX(L,t+offset,visible,travel);
   if(x<L.lane.x-4)continue;if(x>L.W+4)break;
   const b=this.barPool[bi++];if(!b)break;
   b.visible=true;b.position.set(x-1,L.lane.y);b.alpha=.28;
  }
  for(let i=bi;i<this.barPool.length;i++)this.barPool[i].visible=false;
  // Notes: gather visible ones, then assign sprites latest-first so the note
  // nearest the judge circle is drawn on top.
  const shown:{n:Note;x:number}[]=[];
  for(let i=this.upcoming;i<notes.length;i++){
   const n=notes[i],target=n.timeMs+offset;
   if(target>visible+travel*(L.W-L.hitX)/(L.laneRight-L.hitX)+200)break;
   if(n.kind==='tap'&&s.outcomes.has(n.id))continue;
   shown.push({n,x:noteX(L,target,visible,travel)});
  }
  let pi=0,ri=0,si=0;
  const bounce=Math.max(0,Math.cos(beat*Math.PI*2))**6;
  const ns=L.noteR/30;
  const labels:{x:number;text:string}[]=[];
  for(let k=shown.length-1;k>=0;k--){
   const {n,x}=shown[k];
   if(n.kind==='roll'){
    const end=noteX(L,n.endMs+offset,visible,travel);
    const body=this.rollBodies[ri],tail=this.rollTails[ri];ri++;
    if(body&&tail){
     const x0=Math.max(x,L.lane.x-40);
     body.visible=tail.visible=true;body.anchor.set(0,this.tex.rollBody.anchorY);body.position.set(x0,L.laneY);body.scale.y=ns;body.width=Math.max(0,end-x0);
     tail.position.set(end,L.laneY);tail.scale.set(ns);
    }
    const head=this.notePool[pi++];if(head){head.visible=true;this.setTex(head,'rollHead');head.position.set(x,L.laneY);head.scale.set(ns*(1+bounce*.05));}
   }else{
    const key=n.color==='don'?(n.size==='large'?'donL':'don'):(n.size==='large'?'kaL':'ka');
    const sp=this.notePool[pi++];if(!sp)continue;
    sp.visible=true;this.setTex(sp,key);sp.position.set(x,L.laneY-bounce*3);sp.scale.set(ns);
   }
   const text=this.settings.noteLabels?this.syllables.get(n.id):undefined;
   if(text)labels.push({x,text});
  }
  // Syllables from the judge circle outwards; skip one that would overlap the previous.
  let lastRight=-Infinity;
  for(let k=labels.length-1;k>=0;k--){
   const {x,text}=labels[k];const half=(this.tex['syl:'+text]?.texture.width??40)*.25+3;
   if(x-half<lastRight)continue;
   const sy=this.syllablePool[si++];if(!sy)break;
   sy.visible=true;this.setTex(sy,'syl:'+text);sy.position.set(x,L.syllables.y+L.syllables.h/2+2);lastRight=x+half;
  }
  for(let i=pi;i<this.notePool.length;i++)this.notePool[i].visible=false;
  for(let i=ri;i<this.rollBodies.length;i++){this.rollBodies[i].visible=false;this.rollTails[i].visible=false;}
  for(let i=si;i<this.syllablePool.length;i++)this.syllablePool[i].visible=false;
  // Judgement text rises and fades.
  const jAge=now-this.judgeAt;
  for(const [k,sp] of Object.entries(this.judgement)){sp.visible=k===this.judgeKind&&jAge<320;}
  const j=this.judgement[this.judgeKind];
  if(j.visible){j.position.set(L.hitX,(L.portrait?L.laneY-L.judgeR-4:L.lane.y-6)-Math.min(1,jAge/120)*12);j.scale.set(L.portrait?.8:1);j.alpha=jAge>220?1-(jAge-220)/100:1;j.scale.set((L.portrait?.8:1)*(jAge<60?.8+jAge/300:1));}
  const fAge=now-this.fastLateAt;this.fastLate.visible=fAge<420&&this.settings.fastLate;
  if(this.fastLate.visible){this.fastLate.position.set(L.hitX,L.lane.y+L.lane.h-12);this.fastLate.alpha=fAge>300?1-(fAge-300)/120:1;}
  this.judgeGlow.alpha=Math.max(0,this.judgeGlow.alpha-.08);
 }

 private setTex(s:Sprite,key:string){const t=this.tex[key];if(!t)return;if(s.texture!==t.texture){s.texture=t.texture;s.anchor.set(t.anchorX,t.anchorY);}}

 private drawHud(now:number,s:GameSnapshot,time:number){
  const L=this.layout;
  if(s.score!==this.shownScore){this.shownScore=s.score;this.scoreText.text=s.score.toLocaleString('en-US');}
  // Combo on the drum.
  if(s.combo!==this.lastCombo){if(s.combo>this.lastCombo)this.comboPopAt=now;this.lastCombo=s.combo;}
  const showCombo=s.combo>=3;
  this.comboText.visible=this.comboLabel.visible=showCombo;
  if(showCombo){
   if(this.comboText.text!==String(s.combo))this.comboText.text=String(s.combo);
   const age=now-this.comboPopAt,pop=age<110?1+.16*Math.sin(age/110*Math.PI):1;
   const fit=Math.min(1,(L.drum.r*1.35)/Math.max(1,this.comboText.width/this.comboText.scale.x));
   this.comboText.scale.set(fit*pop);
   this.comboText.tint=s.combo>=100?rainbow(now):s.combo>=50?0xffd23f:0xffffff;
  }
  for(const h of Object.values(this.drumHalves)){const age=now-h.at;h.s.alpha=age<150?1-age/150:0;}
  // Gauge (redrawn only when the value changes).
  const value=Math.round(s.gauge*2)/2;
  if(value!==this.gaugeValue){this.gaugeValue=value;this.drawGauge(value);}
  const full=s.gauge>=100;
  this.gaugeShine.alpha=full?.5+.5*Math.sin(now*.01):0;
  this.gaugeFlower.scale.set((L.gauge.h/80)*(full?1.75+.1*Math.sin(now*.012):1.35));
  this.gaugeFlower.rotation=full?now*.002:0;
  this.gaugeFlower.tint=full?0xffffff:s.gauge>=70?0xe8d7a8:0x9c8f7a;
  // Song progress under the syllable strip.
  const p=Math.max(0,Math.min(1,time/this.opts.manifest.durationMs));
  this.progressBar.width=L.progress.w*p;
  // Roll balloon.
  const rAge=now-this.rollAt;
  this.rollBalloon.visible=this.rollCount>0&&rAge<700;
  if(this.rollBalloon.visible){this.rollBalloon.scale.set(rAge<80?1.12-rAge/80*.12:1);this.rollBalloon.alpha=rAge>500?1-(rAge-500)/200:1;}
 }

 private drawGauge(v:number){
  const g=this.layout.gauge,fill=this.gaugeFill;
  fill.clear();
  const x0=g.x+4,w=g.w-g.h*1.6-8,segs=50,sw=w/segs;
  for(let i=0;i<segs;i++){
   const on=(i+1)/segs*100<=v+.001,x=x0+i*sw;
   const past=(i+1)/segs>.7;
   fill.rect(x+1,g.y+5,sw-2,g.h-10).fill(on?(v>=100?0xffe066:past?0xffc233:0xf2553a):(past?0x4a3a2a:0x3a2626));
  }
  this.gaugeShine.clear();
  this.gaugeShine.rect(x0,g.y+5,w,(g.h-10)/2).fill({color:0xffffff,alpha:.35});
 }

 // --------------------------------------------------------------- events --
 private onEvent(e:EffectEvent,time:number,now:number,s:GameSnapshot){
  const L=this.layout,cap=PARTICLE_CAP[this.settings.effects];
  if(e.kind==='great'||e.kind==='ok'){
   this.judgeKind=e.kind;this.judgeAt=now;
   this.judgeGlow.alpha=e.kind==='great'?.9:.5;this.judgeGlow.tint=e.color==='ka'?0x7fe8ff:0xffc27a;
   const large=e.size==='large';
   this.ring(L.hitX,L.laneY,e.kind==='great'?'glowGold':'glowWhite',now,e.kind==='great'?220:160,large?1.1:.8,large?2.4:1.8,.9);
   this.ring(L.hitX,L.laneY,'ring',now,e.kind==='great'?220:140,1,large?2.1:1.7,.85,e.kind==='great'?0xffd86b:0xffffff);
   const count=cap===0?0:e.kind==='great'?10:4;
   for(let i=0;i<count;i++){const a=i/count*Math.PI*2+Math.random()*.3;this.particle('spark',L.hitX,L.laneY,Math.cos(a)*(3+Math.random()*2),Math.sin(a)*(3+Math.random()*2),260,e.kind==='great'?0xffd86b:0xffffff,{gravity:.05,spin:.2});}
   if(this.settings.effects!=='off')this.fly(e.color==='ka'?(large?'kaL':'ka'):(large?'donL':'don'),now,L.noteR/30);
   if(this.settings.fastLate&&e.delta!==undefined&&(e.kind==='ok'||Math.abs(e.delta)>=25)){this.fastLate.text=e.delta<0?'はやい':'おそい';this.fastLate.style.fill=e.delta<0?0x8fe3ff:0xffb38a;this.fastLateAt=now;}
  }else if(e.kind==='miss'){
   this.judgeKind='miss';this.judgeAt=now;
   this.drummerState.react('miss',time);
   if(cap)for(let i=0;i<4;i++)this.particle('dot',L.hitX,L.laneY,(Math.random()-.5)*3,-1-Math.random()*2,220,0x8d96a3,{gravity:.12});
  }else if(e.kind==='roll'){
   const roll=this.opts.chart.notes.find((n):n is Roll=>n.kind==='roll'&&e.timeMs>=n.timeMs+this.opts.chart.offsetMs-400&&e.timeMs<n.endMs+this.opts.chart.offsetMs+400);
   const id=roll?.id??'roll';
   if(id!==this.rollId||now-this.rollAt>900){this.rollId=id;this.rollCount=0;}
   this.rollCount++;this.rollAt=now;
   this.labels.roll=this.rollText.text=`${this.rollCount}\n連打！`;
   this.ring(L.hitX,L.laneY,'glowGold',now,120,.7,1.3,.7);
   if(this.settings.effects!=='off')this.fly(e.color==='ka'?'ka':'don',now,.7*L.noteR/30);
  }else if(e.kind==='combo'){
   const v=e.value??0;
   this.labels.balloon=this.balloonText.text=`${v} コンボ！`;this.balloonAt=now;
   this.drummerState.react('happy',time);
   if(v>=50){this.drummerState.jump(time);for(let i=0;i<18&&cap;i++){const a=-Math.PI/2+(i-9)*.16;this.particle('petal',L.character.x,L.character.y-L.character.height*.7,Math.cos(a)*(2+Math.random()*3),Math.sin(a)*(3+Math.random()*2),900,0xffffff,{gravity:.09,spin:.15,fade:true});}}
   if(v>=100&&v%100===0){this.emblemAt=now;}
  }
  void s;
 }

 private onChorusStart(){
  if(this.settings.effects==='off')return;
  const L=this.layout,st=L.stage;
  const burst=(x:number,y:number,delay:number)=>window.setTimeout(()=>{if(!this.alive)return;const colors=[0xffd86b,0xff6b5a,0x6ee7ff,0xffffff];const n=this.settings.effects==='reduced'?14:36;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const v=2.5+Math.random()*1.5;this.particle('dot',x,y,Math.cos(a)*v,Math.sin(a)*v,900,colors[i%colors.length],{gravity:.035,fade:true,grow:-.0006});}this.ring(x,y,'glowGold',performance.now(),500,.5,2.6,.8);},delay);
  burst(st.x+st.w*.72,st.y+st.h*.32,0);
  burst(st.x+st.w*.86,st.y+st.h*.22,360);
 }
 /** One firework burst (night stage). */
 private firework(x:number,y:number){
  const colors=[0xffd86b,0xff6b5a,0x6ee7ff,0xb58cff,0xffffff];const n=this.settings.effects==='reduced'?10:26;
  const base=Math.floor(Math.random()*colors.length);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const v=2+Math.random()*1.2;this.particle('dot',x,y,Math.cos(a)*v,Math.sin(a)*v,850,colors[(base+i%2)%colors.length],{gravity:.03,fade:true,grow:-.0005});}
  this.ring(x,y,'glowGold',performance.now(),420,.4,2,.6);
 }

 /** Fly a hit note up to the gauge flower. */
 private fly(key:string,now:number,scale:number){
  const L=this.layout,s=this.take(key);if(!s)return;
  s.scale.set(scale);s.alpha=1;s.blendMode='normal';
  const x1=L.gauge.x+L.gauge.w-L.gauge.h*.72,y1=L.gauge.y+L.gauge.h/2;
  this.flyers.push({s,t0:now,dur:420,x0:L.hitX,y0:L.laneY,cx:L.hitX+(x1-L.hitX)*.35,cy:L.gauge.y-(L.portrait?150:120),x1,y1,scale0:scale});
  this.laneFx.addChild(s);
 }
 private ring(x:number,y:number,key:string,now:number,dur:number,scale0:number,scale1:number,alpha:number,tint=0xffffff){
  const s=this.take(key);if(!s)return;
  s.position.set(x,y);s.scale.set(scale0);s.alpha=alpha;s.tint=tint;s.blendMode='add';
  this.rings.push({s,t0:now,dur,scale0,scale1,alpha});this.laneFx.addChild(s);
 }
 private particle(key:string,x:number,y:number,vx:number,vy:number,life:number,tint:number,o:{gravity?:number;spin?:number;fade?:boolean;grow?:number}={}){
  if(this.particles.length>=PARTICLE_CAP[this.settings.effects])return;
  const s=this.take(key);if(!s)return;
  s.position.set(x,y);s.tint=tint;s.alpha=1;s.scale.set(1);s.rotation=Math.random()*Math.PI;s.blendMode='normal';
  this.particles.push({s,vx,vy,life,max:life,spin:o.spin??0,gravity:o.gravity??0,grow:o.grow??0,fade:o.fade??true});
  this.topFx.addChild(s);
 }
 private take(key:string){
  const s=this.spare.pop();if(!s)return null;
  const t=this.tex[key];s.texture=t.texture;s.anchor.set(t.anchorX,t.anchorY);s.visible=true;s.rotation=0;s.tint=0xffffff;
  return s;
 }
 private give(s:Sprite){s.visible=false;s.removeFromParent();this.spare.push(s);}

 private stepEffects(now:number,dt:number){
  const f=dt/16.67;
  for(let i=this.particles.length-1;i>=0;i--){
   const p=this.particles[i];p.life-=dt;
   if(p.life<=0){this.give(p.s);this.particles.splice(i,1);continue;}
   p.vy+=p.gravity*f;p.s.x+=p.vx*f;p.s.y+=p.vy*f;p.s.rotation+=p.spin*f;
   if(p.grow)p.s.scale.set(Math.max(.1,p.s.scale.x+p.grow*dt));
   if(p.fade)p.s.alpha=Math.min(1,p.life/(p.max*.5));
  }
  for(let i=this.flyers.length-1;i>=0;i--){
   const fl=this.flyers[i],k=(now-fl.t0)/fl.dur;
   if(k>=1){this.give(fl.s);this.flyers.splice(i,1);this.gaugeFlower.scale.set(this.gaugeFlower.scale.x*1.04);continue;}
   const e=k*k*(3-2*k),u=1-e;
   fl.s.position.set(u*u*fl.x0+2*u*e*fl.cx+e*e*fl.x1,u*u*fl.y0+2*u*e*fl.cy+e*e*fl.y1);
   fl.s.scale.set(fl.scale0*(1-.45*k));fl.s.alpha=k>.85?(1-k)/.15:1;
  }
  for(let i=this.rings.length-1;i>=0;i--){
   const r=this.rings[i],k=(now-r.t0)/r.dur;
   if(k>=1){this.give(r.s);this.rings.splice(i,1);continue;}
   r.s.scale.set(r.scale0+(r.scale1-r.scale0)*easeOut(k));r.s.alpha=r.alpha*(1-k);
  }
 }

 // --------------------------------------------------------------- public --
 showMessage(text:string,sub='',hold=false){
  if(!this.initialized)return;
  this.labels.message=this.messageText.text=text;this.labels.messageSub=this.messageSub.text=sub;this.messageAt=performance.now();this.messageHold=hold;
 }
 hideMessage(){this.messageHold=false;this.messageAt=-1e9;}

 /** End-of-song banner: full combo / all great / clear. */
 celebrate(kind:'allGreat'|'fullCombo'|'clear'|'finish'){
  if(!this.initialized)return;
  const L=this.layout;
  this.celebration=kind;
  this.drawBanner(kind);
  this.bannerAt=performance.now();
  if(this.settings.effects!=='off'&&kind!=='finish'){
   const colors=[0xff6b5a,0xffd86b,0x6ee7ff,0x7ed36f,0xffffff];
   for(let i=0;i<(this.settings.effects==='reduced'?30:90);i++)window.setTimeout(()=>{if(!this.alive)return;this.particle('confetti',Math.random()*L.W,L.stage.y-10,(Math.random()-.5)*2,1+Math.random()*2,2400,colors[i%colors.length],{gravity:.02,spin:.12,fade:true});},i*18);
  }
 }
 private drawBanner(kind:'allGreat'|'fullCombo'|'clear'|'finish'){
  const L=this.layout;
  this.banner.removeChildren().forEach(c=>c.destroy({children:true}));
  const text=kind==='allGreat'?'全 良！':kind==='fullCombo'?'フルコンボ！':kind==='clear'?'クリア！':'演奏おわり！';
  const color=kind==='allGreat'?0xffd23f:kind==='fullCombo'?0xff7a3d:kind==='clear'?0x6fd36f:0xffffff;
  const wreath=new Container();
  if(kind==='allGreat'||kind==='fullCombo'){
   for(let i=0;i<14;i++){const a=i/14*Math.PI*2;const f=this.sprite('sunflower');f.scale.set(.55);f.position.set(Math.cos(a)*170,Math.sin(a)*78);wreath.addChild(f);}
  }
  const label=new Text({text,style:{fontFamily:art.FONT,fontSize:L.portrait?76:72,fontWeight:'900',fill:color,stroke:{color:C.ink,width:10,join:'round'},dropShadow:{color:0x000000,alpha:.4,distance:4,blur:0,angle:Math.PI/2}}});
  label.anchor.set(.5);
  this.banner.addChild(wreath,label);
  if(kind==='allGreat'){const crown=new Graphics().poly([-40,20,-46,-18,-20,4,0,-30,20,4,46,-18,40,20]).fill(0xffe484).stroke({color:0xb37c28,width:3});crown.y=-86;this.banner.addChild(crown);}
  this.banner.position.set(L.portrait?L.W/2:L.W*.62,L.stage.y+L.stage.h*(L.portrait?.22:.3));
 }

 private trackFrames(now:number){
  if(this.frameWindowAt)this.frameSamples.push(now-this.frameWindowAt);
  this.frameWindowAt=now;if(!this.frameWindowStarted)this.frameWindowStarted=now;
  if(now-this.frameWindowStarted>=5000){
   const a=[...this.frameSamples].sort((a,b)=>a-b);this.metrics.p95=a[Math.floor(a.length*.95)]??0;
   this.slowWindows=this.metrics.p95>25?this.slowWindows+1:0;
   if(this.slowWindows>=3&&this.settings.effects==='standard'){this.settings.effects='reduced';this.metrics.quality='reduced';this.app.renderer.resolution=Math.min(devicePixelRatio||1,1.5);this.resize();}
   this.frameSamples=[];this.frameWindowStarted=now;
  }
 }

 /** Snapshot of renderer state for tests and diagnostics. */
 debug(){
  return {layout:this.layout,chorus:this.chorus,chorusMix:this.chorusMix,friends:this.friends.filter(f=>f.active).length,
   notes:this.notePool.filter(s=>s.visible).length,particles:this.particles.length,flyers:this.flyers.length,
   drummer:this.drummer?.angles(),drummerState:this.drummer?this.host.dataset.state:undefined,pads:this.opts.showPads,
   pose:this.drummer?drummerPose(this.drummerState,this.lastSongTime,0,'idle').state:''};
 }

 dispose(){
  this.alive=false;this.resizeObserver.disconnect();
  if(this.initialized){this.app.destroy(true,{children:true});for(const name of ['ChachaScore','ChachaCombo'])try{BitmapFont.uninstall(name);}catch{/* not installed */}}
  for(const t of Object.values(this.tex??{}))t.texture.destroy(true);
 }
}

function easeOut(k:number){return 1-(1-k)*(1-k);}
function easeOutBack(k:number){const c=1.70158;return 1+(c+1)*Math.pow(k-1,3)+c*Math.pow(k-1,2);}
function rainbow(now:number){const h=(now*.2)%360;const f=(n:number)=>{const k=(n+h/60)%6;return Math.round(255*(1-.45*Math.max(0,Math.min(k,4-k,1))));};return (f(5)<<16)|(f(3)<<8)|f(1);}

function lanternGraphic():Container{
 const g=new Graphics();
 g.rect(-2,0,4,10).fill(0x2b1b12);
 g.roundRect(-18,8,36,8,3).fill(0x1e1726);
 g.ellipse(0,40,26,30).fill(0xe0452f).stroke({color:0x7a1f16,width:2});
 for(let i=-2;i<=2;i++)g.moveTo(i*9,14).quadraticCurveTo(i*12,40,i*9,66).stroke({color:0x9a2a1d,width:1.5,alpha:.7});
 g.ellipse(-8,30,6,14).fill({color:0xffffff,alpha:.18});
 g.roundRect(-16,66,32,8,3).fill(0x1e1726);
 g.rect(-2,74,4,8).fill(0xffd86b);
 return g;
}
