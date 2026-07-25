# Changelog

## [Unreleased]

### Added

- **Auth**: Configurable `authenticationPath` (default `/api/authenticate/mobile`); two-token lifecycle (`access_token` for backend, `proxy_token` for middleware); trusted-origin Authorization helper (exact origin match).
- **MBTiles**: Estimate/create/status/file through authenticated middleware routes using service/layer IDs.

### Changed

- **Auth**: Login field is `access_token` (not `id_token`); Bearer attachment matches trusted base URL path prefixes (middleware first) so gateways send `proxy_token` to `/middleware/**` and `access_token` to `/backend/**`.
- **MBTiles** / **Proxy**: Downloads use Capacitor HTTP `downloadFile` with Bearer; map/resource and MBTiles URLs share the middleware base (`…/middleware/proxy/{app}/{ter}/…`); removed `config.mbtilesUrl`, backend→middleware string rewrite, and dead `localhost:8080/proxy` default.

### Fixed

- **Auth** / **i18n**: Failed login shows an error message; validation errors use i18n keys (`home.loginError`, `home.instanceRequired`) instead of hardcoded Spanish.
