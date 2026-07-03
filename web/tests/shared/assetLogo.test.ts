import assert from 'node:assert/strict'
import { appendVariantParam, resolveLogoVariantUrl } from '../../src/shared/lib/logoUtils'
import { getAssetColorClasses, getAssetInitials } from '../../src/shared/lib/assetInitials'

// getAssetInitials

assert.equal(getAssetInitials('AAPL', 'Apple Inc.'), 'AAP')
assert.equal(getAssetInitials(null, 'Apple Inc.'), 'APP')
assert.equal(getAssetInitials(undefined, undefined), '?')
assert.equal(getAssetInitials('', ''), '?')
assert.equal(getAssetInitials('BRK.B', 'Berkshire Hathaway'), 'BRK')
assert.equal(getAssetInitials('brk.b', null), 'BRK')
assert.equal(getAssetInitials('a', null), 'A')

// getAssetColorClasses

assert.deepEqual(getAssetColorClasses('AAPL'), getAssetColorClasses('AAPL'))
const aapl = getAssetColorClasses('AAPL')
const msft = getAssetColorClasses('MSFT')
assert.equal(typeof aapl.bg, 'string')
assert.equal(typeof aapl.text, 'string')
// Not asserting aapl !== msft generally (palette is finite, collisions are fine),
// but the empty-seed case must still resolve to a defined entry.
assert.ok(getAssetColorClasses('').bg)
assert.ok(msft.bg)

// resolveLogoVariantUrl

assert.equal(
  resolveLogoVariantUrl({ logoLightUrl: 'light.svg', logoDarkUrl: 'dark.svg', logoUrl: null, isDark: true }),
  'dark.svg'
)
assert.equal(
  resolveLogoVariantUrl({ logoLightUrl: 'light.svg', logoDarkUrl: 'dark.svg', logoUrl: null, isDark: false }),
  'light.svg'
)
assert.equal(
  resolveLogoVariantUrl({ logoLightUrl: 'light.svg', logoDarkUrl: null, logoUrl: null, isDark: true }),
  'light.svg'
)
assert.equal(
  resolveLogoVariantUrl({ logoLightUrl: null, logoDarkUrl: 'dark.svg', logoUrl: null, isDark: false }),
  'dark.svg'
)
assert.equal(
  resolveLogoVariantUrl({ logoLightUrl: null, logoDarkUrl: null, logoUrl: 'default.svg', isDark: true }),
  'default.svg'
)
assert.equal(
  resolveLogoVariantUrl({ logoLightUrl: null, logoDarkUrl: null, logoUrl: null, isDark: true }),
  null
)

// appendVariantParam

assert.equal(appendVariantParam('/assets/logo/AAPL', 'dark'), '/assets/logo/AAPL?variant=dark')
assert.equal(appendVariantParam('/assets/logo/AAPL?name=Apple', 'light'), '/assets/logo/AAPL?name=Apple&variant=light')
assert.equal(appendVariantParam('', 'light'), '')
