/**
 * internalAuth — gates routes meant only for other trusted services
 * (currently: the mobile backend asking about a user's credit status).
 *
 * This is a shared secret, not a JWT. Both services must have the SAME
 * INTERNAL_API_SECRET in their .env. If it's missing, refuse everything —
 * never fall back to "allow by default" on a misconfigured secret.
 */

module.exports = function internalAuth(req, res, next) {
  if (!process.env.INTERNAL_API_SECRET) {
    console.error("⚠️ INTERNAL_API_SECRET not set — refusing all internal requests");
    return res.status(500).json({ success: false, error: "Internal auth not configured" });
  }

  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    console.warn("Internal route rejected: missing/invalid x-internal-secret");
    return res.status(401).json({ success: false, error: "Unauthorized internal request" });
  }

  next();
};