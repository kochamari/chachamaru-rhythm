import type {Project,Chart,Note} from '../../../contracts/public-types';
export class Commands {
 private undoStack:Project[]=[];private redoStack:Project[]=[];
 constructor(public project:Project,private changed:()=>void=()=>{}){}
 apply(change:(p:Project)=>void){this.undoStack.push(structuredClone(this.project));if(this.undoStack.length>100)this.undoStack.shift();this.redoStack=[];change(this.project);this.changed();}
 undo(){const p=this.undoStack.pop();if(!p)return;this.redoStack.push(structuredClone(this.project));p.revision=this.project.revision;p.manifest.revision=this.project.manifest.revision;this.project=p;this.changed();}
 redo(){const p=this.redoStack.pop();if(!p)return;this.undoStack.push(structuredClone(this.project));p.revision=this.project.revision;p.manifest.revision=this.project.manifest.revision;this.project=p;this.changed();}
 get canUndo(){return this.undoStack.length>0;}get canRedo(){return this.redoStack.length>0;}
}
export function snapTime(t:number,beats:number[],snap:string){if(snap==='off'||beats.length<2)return Math.round(t);let b=beats.findIndex(x=>x>=t);if(b===-1)b=beats.length-1;b=Math.max(1,b);const a=beats[b-1],z=beats[b],div=Number(snap)/4;return Math.round(a+Math.round((t-a)/(z-a)*div)*(z-a)/div);}
export function moveNotes(chart:Chart,ids:Set<string>,delta:number){for(const n of chart.notes){if(!ids.has(n.id))continue;n.timeMs+=delta;if(n.kind==='roll')n.endMs+=delta;}chart.notes.sort((a,b)=>a.timeMs-b.timeMs);}
export function addNote(chart:Chart,note:Note){chart.notes.push(note);chart.notes.sort((a,b)=>a.timeMs-b.timeMs);}
