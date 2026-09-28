"""Generate a candidate revision; the API commits it under its revision lock."""
import json
import sys
from pathlib import Path
from .core import generate,validate,write_json,load_features,decode,track_beats,bar_phase
from .drums import usable

work=Path(sys.argv[1]);difficulty=sys.argv[2]
try:
    p=json.loads((work/'input.json').read_text());m=p['manifest']
    # The project directory holds the analysis features (work = <project>/jobs/<id>).
    project=work.parent.parent
    before=load_features(project)
    features=load_features(project,compute=True) if p.get('confidence')!='low' else None
    if features and usable(features.get('drums')) and not (before and usable(before.get('drums'))):
        # The first draft that follows the drums (a song analysed before
        # they were used): check the beats and the bar start as a new
        # analysis would, since the drafts rest on them.
        y,sr=decode(project/'song.m4a',work)
        beats,bpm,_,fixes=track_beats(y,sr,m['durationMs'],features['drums'],m['beatTimesMs'],p['bpm'])
        if fixes:
            m['beatTimesMs']=beats;p['bpm']=round(bpm,2)
        if len(beats)>=16:
            phase=bar_phase(y,sr,beats,features)
            m['downbeatIndices']=list(range(phase,len(beats),4))
    c=generate(m['beatTimesMs'],m['durationMs'],difficulty,m['audio']['sha256'],m['sections'],features,m['downbeatIndices'])
    p['charts']=[c if x['difficulty']==difficulty else x for x in p['charts']]
    p['revision']+=1;m['revision']+=1;validate(p)
    write_json(work/'candidate.json',p)
    write_json(work/'status.json',{'status':'REVIEW_READY','progress':100,'message':'下書きを作りました'})
except Exception as e:
    write_json(work/'status.json',{'status':'ERROR','progress':0,'message':'下書きを作れませんでした。保存版は保持されています。','error':str(e)[:500]})
    raise
