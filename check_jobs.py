import json
f = open(r'C:\Users\DELL\project\NeuralineBase\jobs.json', encoding='utf-8-sig')
jobs = json.load(f)['jobs']
for j in jobs:
    name = j['name']
    status = j['status']
    conclusion = j.get('conclusion') or ''
    print(f'{name:40s} {status:15s} {conclusion}')
