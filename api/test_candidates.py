"""Test the candidate name generation and logo path lookup"""
from app.services.logos import _candidate_names, find_logo_path, brandfetch_search, pick_best_brand

# Test candidate name generation
test_names = [
    "Apple Inc.",
    "Microsoft Corporation", 
    "Hitachi, Ltd.",
    "Eli Lilly and Company",
]

for test_name in test_names:
    print(f"\nCandidates for '{test_name}':")
    candidates = list(_candidate_names(test_name))
    for i, cand in enumerate(candidates, 1):
        print(f"  {i}. '{cand}'")
    
    # Try to find logo using the new logic
    logo_path = find_logo_path(test_name)
    if logo_path:
        print(f"  → Logo path found: {logo_path}")
        # Also show which candidate succeeded
        for cand in candidates:
            results = brandfetch_search(cand)
            if results:
                best = pick_best_brand(results)
                if best and best.get("brandId") == logo_path:
                    print(f"  → Matched on candidate: '{cand}' → {best['name']} (verified: {best.get('verified', False)})")
                    break
    else:
        print(f"  → No logo path found")
