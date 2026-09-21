import json
from pathlib import Path
R = r"C:\Users\pasaj\Desktop\kargo_final"
F = {1: R+r"\docs\01-system-overview.md", 2: R+r"\docs\02-roles-and-chain-of-custody.md",
     3: R+r"\docs\03-merchant-order-flow.md", 4: R+r"\docs\04-data-model.md", 5: R+r"\docs\05-open-decisions.md"}
J = {n: R+"\\data\\"+n+".json" for n in ["merchants","orders","packages","roles","tracking_events","invoices"]}
nodes = []
def N(key, label, f, ft="concept"):
    src = F.get(f) or J[f]
    nodes.append({"id": key, "label": label, "file_type": ft, "source_file": src, "source_location": None,
                  "source_url": None, "captured_at": None, "author": None, "contributor": None})
# ---- doc 1: system overview
N("kargo_platform","KARGO Platform",1,"document")
N("merchant_role","Merchant (client)",1)
N("transport_operator","Transport Operator",1)
N("monthly_billing","Monthly Consolidated Billing (ON HOLD)",1,"rationale")
N("principle_mobile_first","Principle: Mobile-first",1,"rationale")
N("principle_merchant_creates_only","Principle: Merchant only creates orders",1,"rationale")
N("rule_scan_timestamp_user","Rule: scan + timestamp + user at every hand-over",1,"rationale")
N("rule_signature","Rule: e-signature only at pickup and delivery",1,"rationale")
N("visual_id_check","Visual ID verification (RUT vs physical ID)",1,"rationale")
N("json_backend","JSON files as backend (prototype)",1,"rationale")
N("ref_kargo_flow_2","Reference app: kargo-flow-2 (best UX)",1,"document")
N("ref_kargo_20","Reference app: kargo 2.0 (best process vision)",1,"document")
N("rebuild_decision","Decision: rebuild from scratch, best of both",1,"rationale")
# ---- doc 2: roles & chain
N("logistics_coordinator","Logistics Coordinator",2)
N("dispatcher","Dispatcher (operator)",2)
N("pickup_driver","Pickup Driver / Assistant",2)
N("warehouse_clerk","Operator Warehouse Clerk (WH1)",2)
N("bus_driver","Bus Driver / Assistant",2)
N("delivery_driver","Delivery Driver / Assistant",2)
steps = [("step1_created","1. Created","merchant_role"),("step2_assigned","2. Assigned to operator","logistics_coordinator"),
 ("step3_pickup_assigned","3. Pickup assigned (driver + vehicle)","dispatcher"),("step4_picked_up","4. Picked up at origin (scan + signature)","pickup_driver"),
 ("step5_wh1","5. Received at operator warehouse WH1 (scan)","warehouse_clerk"),("step6_assigned_transport","6. Assigned to bus / service","warehouse_clerk"),
 ("step7_loaded_bus","7. Loaded onto bus (scan)","bus_driver"),("step8_delivered","8. Delivered at destination (scan + signature)","delivery_driver")]
for k,l,_ in steps: N(k,l,2)
N("merchant_simple_status","Merchant simplified 5-state status",2)
N("chain_of_custody","Chain of custody (8 steps)",2,"document")
# ---- doc 3: order flow
N("wizard","Merchant order registration wizard",3,"document")
N("wz_step1","Wizard 1: origin & destination",3)
N("wz_step2","Wizard 2: authorized persons (min 2 per point)",3)
N("wz_step3","Wizard 3: packages",3)
N("wz_confirm","Confirmation: OT + package codes",3)
N("piece_code","Piece code / QR per package",3)
N("bulk_upload","Bulk CSV upload",3)
N("origin_dropdown","Origin warehouse dropdown filtered by city",3)
N("merchant_portal","Merchant portal sections",3)
N("authorized_persons","Authorized persons (name, RUT, phone)",3)
# ---- doc 4: data model
N("ent_merchant","Entity: Merchant",4); N("ent_warehouse","Entity: Warehouse",4)
N("ent_order","Entity: Order (OT)",4); N("ent_package","Entity: Package",4)
N("ent_event","Entity: Tracking Event (audit log)",4); N("ent_role","Entity: Role",4)
N("ent_invoice","Entity: Invoice (ON HOLD)",4); N("ent_scan","Entity: Scan record",4)
for n in J: N("file_"+n, n+".json", n, "document")
# ---- doc 5: decisions
N("dec_label_printing","Open: how are QR labels printed?",5)
N("dec_offline_scan","Open: failed / offline scan exception flow",5)
N("dec_auth_list","Open: authorized persons closed list vs free entry",5)
N("dec_operator_multi","Open: one operator serves many merchants?",5)
N("dec_partial_delivery","Open: partial delivery handling",5)
N("dec_sla","Open: SLA targets per route / service",5)
N("dec_returns","Open: returns and damaged goods",5)
N("roadmap","Delivery roadmap (6 phases)",5,"document")

edges=[]
def E(s,t,rel,conf="EXTRACTED",score=1.0,f=1):
    edges.append({"source":s,"target":t,"relation":rel,"confidence":conf,"confidence_score":score,
                  "source_file":F.get(f) or J[f],"source_location":None,"weight":1.0})
E("kargo_platform","merchant_role","serves"); E("kargo_platform","transport_operator","coordinates")
E("kargo_platform","monthly_billing","bills_via"); E("kargo_platform","principle_mobile_first","follows")
E("kargo_platform","principle_merchant_creates_only","follows"); E("kargo_platform","rule_scan_timestamp_user","enforces")
E("rule_scan_timestamp_user","rule_signature","extended_by"); E("rule_signature","visual_id_check","supported_by")
E("kargo_platform","json_backend","prototyped_on"); E("rebuild_decision","ref_kargo_flow_2","takes_ux_from"); E("rebuild_decision","ref_kargo_20","takes_process_from")
E("rebuild_decision","kargo_platform","produces")
for r in ["dispatcher","pickup_driver","warehouse_clerk","bus_driver","delivery_driver"]:
    E("transport_operator",r,"includes",f=2)
E("logistics_coordinator","transport_operator","assigns_order_to",f=2)
for i,(k,l,actor) in enumerate(steps):
    E(k,actor,"performed_by",f=2); E("chain_of_custody",k,"contains",f=2)
    if i: E(steps[i-1][0],k,"precedes",f=2)
for k in ["step4_picked_up","step5_wh1","step7_loaded_bus","step8_delivered"]: E(k,"rule_scan_timestamp_user","requires",f=2)
for k in ["step4_picked_up","step8_delivered"]: E(k,"rule_signature","requires",f=2); E(k,"visual_id_check","requires",f=2)
E("merchant_simple_status","chain_of_custody","summarizes",f=2)
E("merchant_role","principle_merchant_creates_only","limited_by",f=1)
E("wizard","merchant_role","used_by",f=3)
for b in ["wz_step1","wz_step2","wz_step3","wz_confirm"]: E("wizard",b,"contains",f=3)
E("wz_step1","wz_step2","precedes",f=3); E("wz_step2","wz_step3","precedes",f=3); E("wz_step3","wz_confirm","precedes",f=3)
E("wz_step1","origin_dropdown","uses",f=3); E("wz_step2","authorized_persons","captures",f=3)
E("authorized_persons","visual_id_check","enables",f=3); E("wz_confirm","piece_code","generates",f=3)
E("wz_confirm","step1_created","results_in",f=3); E("bulk_upload","wizard","fast_path_of",f=3)
E("merchant_portal","wizard","hosts",f=3); E("origin_dropdown","ent_warehouse","reads",f=3)
E("piece_code","step4_picked_up","scanned_at","INFERRED",0.85,f=3)
E("ent_merchant","ent_warehouse","has_many",f=4); E("ent_merchant","ent_order","has_many",f=4)
E("ent_order","ent_package","has_many",f=4); E("ent_order","ent_event","logs",f=4)
E("ent_package","ent_scan","has_many",f=4); E("ent_order","ent_invoice","billed_in",f=4)
E("ent_role","ent_order","permissions_over",f=4); E("ent_event","ent_scan","source_of","INFERRED",0.85,f=4)
E("ent_order","chain_of_custody","timeline_follows","INFERRED",0.85,f=4)
for ent,fn in [("ent_merchant","merchants"),("ent_warehouse","merchants"),("ent_order","orders"),("ent_package","packages"),
               ("ent_event","tracking_events"),("ent_role","roles"),("ent_invoice","invoices"),("ent_scan","packages")]:
    E(ent,"file_"+fn,"stored_in",f=4)
E("ent_invoice","monthly_billing","implements",f=4)
E("ent_scan","rule_scan_timestamp_user","records","INFERRED",0.95,f=4)
E("ent_order","authorized_persons","holds",f=4)
E("dec_label_printing","piece_code","affects",f=5); E("dec_offline_scan","rule_scan_timestamp_user","challenges",f=5)
E("dec_auth_list","authorized_persons","affects",f=5); E("dec_operator_multi","transport_operator","affects",f=5)
E("dec_partial_delivery","step8_delivered","affects",f=5); E("dec_sla","ent_order","affects",f=5)
E("dec_returns","merchant_portal","affects","INFERRED",0.75,f=5)
E("roadmap","wizard","phase_1",f=5); E("roadmap","logistics_coordinator","phase_3",f=5)
E("roadmap","pickup_driver","phase_4_scanning_app","INFERRED",0.85,f=5); E("roadmap","monthly_billing","phase_6_last",f=5)
E("monthly_billing","principle_merchant_creates_only","no_payment_at_order_creation","INFERRED",0.75,f=1)
E("ref_kargo_flow_2","wizard","inspired","INFERRED",0.85,f=1)
E("ref_kargo_20","chain_of_custody","inspired","INFERRED",0.85,f=1)
hyper=[{"id":"scan_handover_steps","label":"Hand-over steps requiring package scan","nodes":["step4_picked_up","step5_wh1","step7_loaded_bus","step8_delivered"],"relation":"participate_in","confidence":"EXTRACTED","confidence_score":1.0,"source_file":F[2]},
{"id":"signature_steps","label":"Steps requiring signature + visual ID check","nodes":["step4_picked_up","step8_delivered","visual_id_check","authorized_persons"],"relation":"participate_in","confidence":"EXTRACTED","confidence_score":1.0,"source_file":F[2]},
{"id":"operator_roles","label":"Transport Operator internal roles","nodes":["dispatcher","pickup_driver","warehouse_clerk","bus_driver","delivery_driver"],"relation":"form","confidence":"EXTRACTED","confidence_score":1.0,"source_file":F[2]}]
ids_all={n["id"] for n in nodes}
bad=[e for e in edges if e["source"] not in ids_all or e["target"] not in ids_all]
assert not bad, bad
Path("graphify-out/.graphify_semantic.json").write_text(json.dumps({"nodes":nodes,"edges":edges,"hyperedges":hyper,"input_tokens":0,"output_tokens":0},indent=2,ensure_ascii=False),encoding="utf-8")
print(len(nodes),"nodes",len(edges),"edges")
