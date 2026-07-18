# Changelog

## [Unreleased]

### Added

- Configurable `authenticationPath` (default `/api/authenticate/mobile`)
- Viewer-style two-token lifecycle: `access_token` for backend, `proxy_token` for middleware
- Trusted-origin Authorization helper (exact origin match only)
- MBTiles estimate/create/status/file through authenticated middleware routes using service/layer IDs

### Fixed

- Failed mobile login (HTTP reject) shows the login error message instead of failing silently
- Login validation errors use i18n keys (`home.loginError`, `home.instanceRequired`) instead of hardcoded Spanish

### Changed

- Login response field is `access_token` (not `id_token`)
- MBTiles downloads use Capacitor HTTP `downloadFile` with Bearer headers
- Removed direct `config.mbtilesUrl` usage and `backend`→`middleware` string rewrite for estimates
- Map/resource proxy URLs use the same middleware base as MBTiles (`…/middleware/proxy/{app}/{ter}/…`); removed dead `localhost:8080/proxy` default and unused `setProxyUrl`
- Bearer attachment matches trusted **base URL path prefixes** (middleware checked first) so same-origin gateways send `proxy_token` to `/middleware/**` and `access_token` to `/backend/**`
