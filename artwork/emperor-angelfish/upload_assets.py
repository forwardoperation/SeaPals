import json, urllib.request, concurrent.futures
from pathlib import Path
root=Path(__file__).parent
entries=json.loads((root/'upload-config.json').read_text())
def send(e):
    req=urllib.request.Request(e['submitUrl'], data=(root/e['filename']).read_bytes(),headers={'Content-Type':'image/svg+xml'}, method='POST')
    try:
        with urllib.request.urlopen(req,timeout=180) as r: result=json.load(r)
        return {'filename':e['filename'],'result':result}
    except Exception as ex: return {'filename':e['filename'],'error':str(ex)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(send,entries))
(root/'upload-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results))
