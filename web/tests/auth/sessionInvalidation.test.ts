import assert from 'node:assert/strict'

import { ApiRequestError, shouldInvalidateSession } from '../../src/api/client'


assert.equal(shouldInvalidateSession(new ApiRequestError('expired', 401)), true)
assert.equal(shouldInvalidateSession(new ApiRequestError('inactive', 403)), true)
assert.equal(shouldInvalidateSession(new ApiRequestError('server failure', 500)), false)
assert.equal(shouldInvalidateSession(new Error('network unavailable')), false)
assert.equal(shouldInvalidateSession(new Error('Request timeout')), false)
