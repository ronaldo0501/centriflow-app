const axios = require('axios');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
const TOKEN_TTL = 8 * 60 * 60; // 8 hours in seconds

const getCWToken = async (org) => {
  const cacheKey = `cw_token:${org.id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const settings = org.org_settings || {};
  const { cw_username, cw_password } = settings;

  if (!org.cw_base_url || !cw_username || !cw_password) {
    throw new Error('Cityworks credentials not configured for this org');
  }

  const response = await axios.post(
    `${org.cw_base_url}/Services/Authentication/authenticate`,
    { LoginName: cw_username, Password: cw_password, Domain: org.cw_domain || '' },
    { timeout: 10000 }
  );

  if (response.data?.Status !== 0) {
    throw new Error(`Cityworks auth failed: ${response.data?.Message || 'Unknown error'}`);
  }

  const token = response.data.Value?.Token;
  if (!token) throw new Error('No token returned from Cityworks');

  await redis.setex(cacheKey, TOKEN_TTL - 300, token); // refresh 5 min early
  return token;
};

const invalidateCWToken = async (orgId) => {
  await redis.del(`cw_token:${orgId}`);
};

const testCWConnection = async ({ cw_base_url, cw_domain, cw_username, cw_password }) => {
  const response = await axios.post(
    `${cw_base_url}/Services/Authentication/authenticate`,
    { LoginName: cw_username, Password: cw_password, Domain: cw_domain || '' },
    { timeout: 10000 }
  );

  if (response.data?.Status !== 0) {
    return { success: false, message: response.data?.Message || 'Authentication failed' };
  }

  return { success: true, message: 'Connected successfully' };
};

module.exports = { getCWToken, invalidateCWToken, testCWConnection };
