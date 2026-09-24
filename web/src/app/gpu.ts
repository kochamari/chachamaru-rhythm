// Detects WebGL that runs on the CPU (SwiftShader, llvmpipe, Microsoft Basic
// Render Driver…), where every composited frame and every filter is paid for
// by the processor. Such machines get lighter defaults: no costly CSS filters
// or decorative loops on menus, and a lower play-screen resolution. Never
// blocks play; any failure counts as "hardware".

const SOFTWARE=/swiftshader|llvmpipe|softpipe|software|basic render/i;
let cached:boolean|undefined;

export function isSoftwareRenderer(name:string){return SOFTWARE.test(name);}

export function softwareRendering():boolean{
 if(cached!==undefined)return cached;
 cached=false;
 try{
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl2')??canvas.getContext('webgl');
  if(!gl)return cached;
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  cached=isSoftwareRenderer(String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
 }catch{/* keep the hardware defaults */}
 return cached;
}

/** Marks <html data-render="software"> so styles.css can drop costly effects. */
export function markRenderer(){
 if(softwareRendering())document.documentElement.dataset.render='software';
}
