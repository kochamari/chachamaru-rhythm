export type Color = 'don' | 'ka';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type InputMode = 'touch' | 'keyboard' | 'midi' | 'mixed';
export type Tap = {id:string;kind:'tap';timeMs:number;color:Color;size:'normal'|'large'};
export type Roll = {id:string;kind:'roll';timeMs:number;endMs:number};
export type Note = Tap|Roll;
export interface Section {kind:'intro'|'verse'|'chorus'|'bridge';startMs:number;endMs:number;confirmed:boolean}
export interface Chart {schemaVersion:1;chartId:string;difficulty:Difficulty;offsetMs:number;notes:Note[]}
export interface Manifest {schemaVersion:1;packId:string;revision:number;title:string;artist:string;durationMs:number;audio:{path:string;sha256:string};charts:{chartId:string;difficulty:Difficulty;path:string;sha256:string}[];beatTimesMs:number[];downbeatIndices:number[];sections:Section[];cover?:{path:string;sha256:string};generator?:string}
export interface SongPackage {manifest:Manifest;charts:Chart[];audio:Blob;cover?:Blob;source?:'demo'|'import'|'studio'}
export type Outcome='great'|'ok'|'miss';
export interface HitEvent {id:string;runId:string;color:Color;inputSongMs:number;receiptSongMs:number;deliveryDelayMs?:number;source:InputMode}
export interface GameSnapshot {score:number;baseScore:number;rollBonus:number;rollHits:number;great:number;ok:number;miss:number;combo:number;maxCombo:number;gauge:number;accuracy:number;fullCombo:boolean;allGreat:boolean;resolved:number;total:number;timingUnstable:boolean;finished:boolean;outcomes:ReadonlyMap<string,Outcome>;deltas:readonly number[]}
export interface EffectEvent {kind:Outcome|'roll'|'combo'|'chorus';color?:Color;delta?:number;value?:number;timeMs:number;size?:'normal'|'large';noteId?:string}
export interface Settings {bgm:number;hit:number;effect:number;ui:number;midiHit:number;effects:'standard'|'reduced'|'off';audioDelayMs:number;inputLagMs:number;visualAdvanceMs:number;profile:string;inputMode:InputMode;noteLabels:boolean;fastLate:boolean;festival:boolean;midi:{don:{note:number;channel:number}|null;ka:{note:number;channel:number}|null;velocity:number};calibrationProfiles:Record<string,{audioDelayMs:number;inputLagMs:number;visualAdvanceMs:number}>;/** Note scroll speed multiplier (visual only). Optional for older saves. */scrollSpeed?:number;/** Stroke sound set. Optional for older saves. */hitSound?:'taiko'|'pop'|'wood';/** Legacy: tap vibration was removed (2026-09-26); older saves may still carry it. */haptics?:boolean}
export interface RunResult {runId:string;packId:string;chartId:string;audioHash:string;chartHash:string;ruleset:'chacha-v1';inputMode:InputMode;autoplay:boolean;practice:boolean;date:string;settings:Settings;stats:Omit<GameSnapshot,'outcomes'>;title:string;difficulty:Difficulty;timingUnstable:boolean}
export interface Project {projectId:string;revision:number;manifest:Manifest;charts:Chart[];waveform:number[];bpm:number;confidence:'low'|'medium'|'high';warnings:string[];analysis:{sampleRate:number;hopLength:number;audioSha256:string};originalHash:string}
