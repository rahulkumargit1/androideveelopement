"""Quick determinism + accuracy test for the fixed pipeline."""
import requests
import json

IMG = r"E:\FAKECURRENCYDETECTION\dhanush.jpeg"
URL = "http://localhost:8000/api/scan"

scores = []
for i in range(3):
    with open(IMG, "rb") as f:
        r = requests.post(URL, files={"image": ("test.jpeg", f, "image/jpeg")})
    j = r.json()
    s = j["authenticity_score"]
    v = j["verdict"]
    cur = j["currency"]
    den = j["denomination"]
    conf = j["confidence"]
    scores.append(s)
    print(f"Run {i+1}: {cur} {den} | score={s:.4f} verdict={v} confidence={conf:.4f}")

    if i == 0:
        bd = j.get("breakdown", {})
        ss = bd.get("subscores", {})
        print("\n  Sub-scores:")
        for k in sorted(ss):
            print(f"    {k:25s} = {ss[k]:.4f}")
        ml_model = bd.get("model", "?")
        print(f"\n  ML model: {ml_model}")
        mp = bd.get("matched_profile")
        if mp:
            print(f"  Matched profile: {mp['currency']} {mp['denomination']}")
        lab = bd.get("lab", {})
        if lab:
            print(f"  Lab: L={lab.get('L')}, a={lab.get('a')}, b={lab.get('b')}, chroma={lab.get('chroma')}")
        print()

spread = max(scores) - min(scores)
print(f"\nDeterminism: spread={spread:.6f}  {'PASS' if spread < 0.001 else 'CHECK'}")
