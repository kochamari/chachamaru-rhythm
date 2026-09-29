#!/bin/zsh
# Optional: lets the Mac Studio hear a song's parts apart (the singing, the
# drums, the rest) with Demucs, so its drafts follow the singing.
# Installs Demucs and PyTorch (versions in studio/stems.lock, from PyPI) in
# _private/stems-venv, apart from the Studio's own Python, and fetches the
# htdemucs model (about 80 MB, from Meta's server dl.fbaipublicfiles.com)
# into _private/models. About 800 MB in all. Songs never leave this Mac.
# Remove: delete _private/stems-venv and _private/models.
set -euo pipefail
repo="${0:A:h:h}"
cd "$repo"
if [[ ! -x .venv/bin/python ]]; then
  echo "先に譜面工房の初回セットアップをしてください（README.md）" >&2
  exit 1
fi
.venv/bin/python -m venv _private/stems-venv
_private/stems-venv/bin/python -m pip install --quiet -r studio/stems.lock
# Fetch the model now (the first separation would otherwise do it).
TORCH_HOME="$repo/_private/models" PYTHONPATH="$repo/studio" _private/stems-venv/bin/python -c '
import certifi, os
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
from chacha_studio.separate import model
m = model()
print("音源分離の準備ができました:", ", ".join(m.sources))
'
