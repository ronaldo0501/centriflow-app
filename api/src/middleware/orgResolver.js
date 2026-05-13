const { query } = require('../db');

const orgCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const getCachedOrg = async (identifier, field) => {
  const cacheKey = `${field}:${identifier}`;
  const cached = orgCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.org;

  const result = await query(
    `SELECT id, name, slug, state, plan_tier, cw_enabled, cw_base_url,
            cw_domain, cw_sync_mode, cw_sr_problem_sid, cw_wo_template_sid,
            fee_config, org_settings, approved_list_sources, lob_enabled, status
     FROM organizations WHERE ${field} = $1 AND status != 'suspended'`,
    [identifier]
  );
  const org = result.rows[0] || null;
  if (org) orgCache.set(cacheKey, { org, ts: Date.now() });
  return org;
};

const PUBLIC_PATHS = [
  '/auth/',
  '/api/v1/devices/lookup',
  '/api/v1/testers/register',
  '/api/v1/testers/public',
  '/webhooks/',
  '/health',
];

const orgResolver = async (req, res, next) => {
  try {
    if (process.env.ORG_SUBDOMAIN_MODE === 'true') {
      const host = req.hostname.toLowerCase();
      const baseDomain = (process.env.BASE_DOMAIN || 'centriflow.centricitygis.com').toLowerCase();
      const subdomainRegex = new RegExp(`^([a-z0-9-]+)\\.${baseDomain.replace(/\./g, '\\.')}$`);
      const match = host.match(subdomainRegex);
      if (match && match[1] !== 'www' && match[1] !== 'api') {
        const org = await getCachedOrg(match[1], 'slug');
        if (!org) return res.status(404).json({ success: false, error: 'Organization not found', code: 'ORG_NOT_FOUND' });
        req.org = org;
        return next();
      }
    }

    const slugFromHeader = req.headers['x-org-slug'];
    if (slugFromHeader) {
      const org = await getCachedOrg(slugFromHeader, 'slug');
      if (org) { req.org = org; return next(); }
    }

    if (req.user?.org_id) {
      const org = await getCachedOrg(req.user.org_id, 'id');
      if (org) { req.org = org; return next(); }
    }

    const isPublic = PUBLIC_PATHS.some(p => req.path.startsWith(p));
    if (isPublic) return next();

    return res.status(401).json({ success: false, error: 'Unable to resolve organization context', code: 'ORG_CONTEXT_MISSING' });
  } catch (err) {
    console.error('orgResolver error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error in org resolution', code: 'ORG_RESOLVER_ERROR' });
  }
};

const invalidateOrgCache = (orgId, slug) => {
  orgCache.delete(`id:${orgId}`);
  if (slug) orgCache.delete(`slug:${slug}`);
};

module.exports = { orgResolver, invalidateOrgCache };
