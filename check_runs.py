import json
runs = json.load(open(r'C:\Users\DELL\project\NeuralineBase\runs.json'))['workflow_runs']
for r in runs[:5]:
    name = r['name']
    status = r['status']
    conclusion = r.get('conclusion') or ''
    sha = r['head_sha'][:8]
    print(f'{name:30s} {status:15s} {conclusion:15s} {sha}')
