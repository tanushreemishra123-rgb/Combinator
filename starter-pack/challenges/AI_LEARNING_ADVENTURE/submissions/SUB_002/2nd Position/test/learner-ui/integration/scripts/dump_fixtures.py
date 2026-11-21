import json, os

base = os.path.join('test', 'learner-app', 'integration', 'fixtures', 'mission-data')

def load(name):
    with open(os.path.join(base, name), encoding='utf-8') as f:
        return json.load(f)

missions = load('missions.json')
print('missions:', len(missions))
for m in missions:
    print(f"{m['id']} | {m['title']} | {m['difficulty']} | {m['levelTrack']} | order {m['trackOrder']} | prereq {m['prerequisiteMissionId']}")

questions = load('questions.json')
print()
print('questions:', len(questions))
for q in questions:
    print(f"{q['id']} | {q['missionId']} | {q['type']} | {q.get('selectionMode')} | tags {q.get('conceptTags')}")

cards = load('flashcards.json')
print()
print('flashcards:', len(cards))
for c in cards:
    print(f"{c['id']} | {c['missionId']} | {c['concept']} | tags {c.get('conceptTags')}")

awards = load('awards.json')
print()
print('awards:', len(awards))
for a in awards:
    print(f"{a.get('id')} | {a.get('missionId')} | {a.get('rule')} | {a.get('threshold')} | {a.get('name')}")

sp = load('sample-progress.json')
print()
print('sample-progress:', json.dumps(sp)[:2000])
