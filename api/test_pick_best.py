"""Test the new pick_best_brand scoring logic"""
from app.services.logos import brandfetch_search, pick_best_brand

# Test with "Apple Inc." - should prefer verified Apple over Oak & Apple
results = brandfetch_search('Apple Inc.')
print(f"Found {len(results)} results for 'Apple Inc.':")
for r in results:
    print(f"  - {r['name']} (domain: {r['domain']}, verified: {r.get('verified', False)}, claimed: {r.get('claimed', False)}, quality: {r['qualityScore']:.3f})")

best = pick_best_brand(results)
if best:
    print(f"\nBest brand selected: {best['name']} (domain: {best['domain']}, brandId: {best['brandId']})")
else:
    print("\nNo brand selected")

# Also test with just "Apple" - should get the real Apple
print("\n" + "="*80)
results2 = brandfetch_search('Apple')
print(f"Found {len(results2)} results for 'Apple':")
for r in results2:
    print(f"  - {r['name']} (domain: {r['domain']}, verified: {r.get('verified', False)}, claimed: {r.get('claimed', False)}, quality: {r['qualityScore']:.3f})")

best2 = pick_best_brand(results2)
if best2:
    print(f"\nBest brand selected: {best2['name']} (domain: {best2['domain']}, brandId: {best2['brandId']})")
else:
    print("\nNo brand selected")
