import sys
import os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'studio'))
os.environ['CHACHA_TEST']='1'
os.environ['NUMBA_CACHE_DIR']=str(Path(__file__).resolve().parents[2]/'_private/numba-cache')
