import assert from 'node:assert/strict'

import { normalizePreferredLanguage } from '../../src/api/auth'


assert.equal(normalizePreferredLanguage('en-US@posix'), 'en')
assert.equal(normalizePreferredLanguage('fr-FR'), 'fr')
assert.equal(normalizePreferredLanguage('fr_FR'), 'fr')
assert.equal(normalizePreferredLanguage('de-DE'), 'en')
assert.equal(normalizePreferredLanguage(undefined), 'en')
