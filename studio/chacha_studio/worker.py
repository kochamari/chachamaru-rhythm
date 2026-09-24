import argparse
from pathlib import Path
from .core import analyze,write_json
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('directory');p.add_argument('title');p.add_argument('artist');a=p.parse_args()
directory=Path(a.directory)
def progress(status,value,message):write_json(directory/'status.json',{'status':status,'progress':value,'message':message})
try:analyze(a.source,directory,a.title,a.artist,progress)
except Exception as e:
    for name in ['song.m4a','analysis.wav','original.upload','project.json','project.tmp']:
        (directory/name).unlink(missing_ok=True)
    write_json(directory/'status.json',{'status':'ERROR','progress':0,'message':'解析に失敗しました。音源を確認して再試行してください。','error':str(e)[:500]})
    raise
