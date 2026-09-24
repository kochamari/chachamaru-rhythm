"""Generate a candidate revision; the API commits it under its revision lock."""
import json
import sys
from pathlib import Path
from .core import generate,validate,write_json,load_features

work=Path(sys.argv[1]);difficulty=sys.argv[2]
try:
    p=json.loads((work/'input.json').read_text());m=p['manifest']
    # The project directory holds the analysis features (work = <project>/jobs/<id>).
    features=load_features(work.parent.parent,compute=True) if p.get('confidence')!='low' else None
    c=generate(m['beatTimesMs'],m['durationMs'],difficulty,m['audio']['sha256'],m['sections'],features,m['downbeatIndices'])
    p['charts']=[c if x['difficulty']==difficulty else x for x in p['charts']]
    p['revision']+=1;m['revision']+=1;validate(p)
    write_json(work/'candidate.json',p)
    write_json(work/'status.json',{'status':'REVIEW_READY','progress':100,'message':'下書きを作りました'})
except Exception as e:
    write_json(work/'status.json',{'status':'ERROR','progress':0,'message':'下書きを作れませんでした。保存版は保持されています。','error':str(e)[:500]})
    raise
