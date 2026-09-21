import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report

O = Path('graphify-out')
ast = json.loads((O/'.graphify_ast.json').read_text(encoding='utf-8'))
sem = json.loads((O/'.graphify_semantic.json').read_text(encoding='utf-8'))
ext = {'nodes': ast['nodes'] + sem['nodes'], 'edges': ast['edges'] + sem['edges'],
       'hyperedges': sem.get('hyperedges', []), 'input_tokens': 0, 'output_tokens': 0}
(O/'.graphify_extract.json').write_text(json.dumps(ext, indent=2, ensure_ascii=False), encoding='utf-8')
detection = json.loads((O/'.graphify_detect.json').read_text(encoding='utf-8'))

G = build_from_json(ext, root='.', directed=True)
assert G.number_of_nodes() > 0
comms = cluster(G)
coh = score_all(G, comms)
gods = god_nodes(G)
surp = surprising_connections(G, comms)

# print communities so labels can be chosen from real membership
for cid, members in comms.items():
    print(cid, [G.nodes[m].get('label', m) for m in members][:14])

labels_file = O/'.graphify_labels_in.json'
labels = {int(k): v for k, v in json.loads(labels_file.read_text(encoding='utf-8')).items()} if labels_file.exists() else {cid: f'Community {cid}' for cid in comms}
for cid in comms: labels.setdefault(cid, f'Community {cid}')
q = suggest_questions(G, comms, labels)
assert to_json(G, comms, 'graphify-out/graph.json', community_labels=labels)
(O/'GRAPH_REPORT.md').write_text(generate(G, comms, coh, labels, gods, surp, detection, {'input': 0, 'output': 0}, '.', suggested_questions=q), encoding='utf-8')
(O/'.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding='utf-8')
print(format_diagnostic_report(diagnose_extraction(ext, directed=True, root='.')))
print('Graph:', G.number_of_nodes(), 'nodes', G.number_of_edges(), 'edges', len(comms), 'communities')
