# Real Docker + Wings migration plan

## Current production architecture (verified from this repository)

This repository is a custom Node.js/Express panel. It is not the official PHP Pterodactyl Panel and is not currently a complete Wings-compatible control plane.

Current limitations:
- `backend/src/processes/ServerProcessManager.ts` launches Node.js/Python processes with host `child_process.spawn()`.
- The Python and Node.js egg definitions describe runtime configuration, but do not provision Docker containers.
- `backend/src/api/daemonRouter.ts` is a custom file-transfer API. Its existence does not make the application compatible with the complete Wings API.
- `backend/src/api/adminRouter.ts` currently enforces single-node mode and redirects node routes.
- `config/index.ts` and the database schema are designed around the current custom single-node implementation.
- A Railway service's `localhost` is the Railway container itself. It is not the user's PC, nor a separate VPS.

Do not advertise the current Node.js/Python host-process mode as isolated Docker hosting.

## Target architecture

Keep the existing Railway service and persistent volume as the control-plane deployment during migration planning. Run the execution plane on a separate Linux machine with:
- A supported Linux distribution and kernel.
- Docker Engine and its daemon running persistently.
- Official Pterodactyl Wings installed and configured as a system service.
- A stable reachable IP or private network address, firewall rules, and TLS for the Wings API.
- Public allocations for the actual game/application ports as needed.

The panel and node must communicate over an authenticated, encrypted network connection. Never expose the Docker socket over TCP to the public internet.

## Important compatibility gate

Official Wings expects the Pterodactyl Panel API contract, authentication, server configuration payloads, node configuration, and daemon event/websocket behaviour. This custom Express application does not implement that complete contract.

Therefore, a real Wings node must NOT be pointed at this custom panel until compatibility has been implemented and tested. The recommended production-safe route is to deploy the official Pterodactyl Panel as the control plane, import/recreate the required Node.js and Python eggs there, and attach official Wings nodes. Keep this custom Railway app and its database intact during the transition; migrate data only after a tested mapping and backup/restore rehearsal.

An alternative is a substantial compatibility project: implement and test every required Panel API endpoint, authentication mechanism, server lifecycle operation, configuration endpoint, websocket/event flow, and node/allocation model expected by the exact Wings release. A few placeholder routes or a Docker-image dropdown are not sufficient.

## Localhost and automatic node registration

- If the panel and Wings run on the same Linux host, the node may use a loopback/private address only when the panel can actually reach it on that same network namespace.
- If the panel remains on Railway and Wings runs on a VPS or a PC, `127.0.0.1` / `localhost` points to the Railway container, not the remote machine. Use a secured reachable address or private overlay network.
- Never make a public "auto-create node" endpoint that accepts an arbitrary URL and sends credentials to it. This creates an SSRF/credential-exfiltration risk.
- Node registration must be administrator-only, CSRF-protected, authenticated, idempotent, and must verify the node's TLS identity and health before marking it online.
- Do not store raw Wings tokens in browser-visible HTML, logs, or client-side JavaScript. Store secrets encrypted or in the deployment secret manager and support rotation.

## Safe migration sequence

1. Take a database backup and a copy of the persistent volume. Verify that both can be restored.
2. Keep the existing Railway service, domain, database, and `/app/storage` volume unchanged.
3. Provision a separate Linux VPS with root access and a public/reachable IP. Confirm Docker Engine works before installing Wings.
4. Install and configure official Wings on the VPS; verify its daemon service and API locally before exposing it.
5. Deploy the official compatible Pterodactyl Panel as a separate control plane, or complete the full API compatibility implementation for this custom panel. Do not connect Wings to the custom panel prematurely.
6. Import Node.js and Python eggs; verify image availability, startup variables, resource limits, filesystem isolation, networking, console, SFTP, and power actions.
7. Migrate one disposable test server first. Test start/stop/restart, crash recovery, logs, file operations, resource limits, and port allocations.
8. Only after successful tests, plan a controlled migration of existing users and server files. Keep rollback backups.

## Current status

This document records the verified architecture boundary and safe migration plan. It does not install Docker, provision a VPS, configure Wings, migrate the database, or claim that real containers are running. Those actions require a reachable Linux execution host and a compatible Panel API.
