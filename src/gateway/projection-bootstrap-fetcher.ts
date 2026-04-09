/**
 * Projection Bootstrap Fetcher
 *
 * Provides an operator-facing, non-mock path for loading projection bootstrap packets
 * from a configurable URL or local file. Works alongside the real Gateway connection.
 *
 * Configuration via environment variables:
 * - VITE_PROJECTION_BOOTSTRAP_URL: URL to fetch the bootstrap packet (JSON)
 * - VITE_PROJECTION_BOOTSTRAP_PATH: Alternative - local file path (for dev)
 *
 * Guarded behavior: If neither is configured, does nothing.
 */

import type { ProjectionBootstrapPacket } from "@/gateway/types";

/**
 * Fetch projection bootstrap packet from configured source.
 * Returns null if no source is configured or if fetch fails.
 */
export async function fetchProjectionBootstrap(): Promise<ProjectionBootstrapPacket | null> {
  const url = import.meta.env.VITE_PROJECTION_BOOTSTRAP_URL;
  const path = import.meta.env.VITE_PROJECTION_BOOTSTRAP_PATH;

  // No source configured
  if (!url && !path) {
    return null;
  }

  try {
    if (url) {
      return await fetchFromUrl(url);
    }
    if (path) {
      return await fetchFromPath(path);
    }
  } catch (error) {
    console.warn(
      "[projection-bootstrap-fetcher] Failed to load bootstrap packet:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }

  return null;
}

/**
 * Fetch bootstrap packet from a remote URL.
 */
async function fetchFromUrl(url: string): Promise<ProjectionBootstrapPacket | null> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const packet = await response.json();
  return validatePacket(packet);
}

/**
 * Fetch bootstrap packet from a local file path.
 * Note: This only works in dev mode with Vite's file access.
 */
async function fetchFromPath(path: string): Promise<ProjectionBootstrapPacket | null> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.statusText}`);
  }

  const packet = await response.json();
  return validatePacket(packet);
}

/**
 * Validate that the loaded packet has the expected structure.
 * Returns the packet if valid, throws if invalid.
 * Exported for testing purposes.
 */
export function validatePacket(packet: unknown): ProjectionBootstrapPacket {
  if (!packet || typeof packet !== "object") {
    throw new Error("Invalid packet: not an object");
  }

  const p = packet as Record<string, unknown>;

  // Required fields
  if (typeof p.schemaVersion !== "string") {
    throw new Error("Invalid packet: missing or invalid schemaVersion");
  }
  if (typeof p.generatedAt !== "string") {
    throw new Error("Invalid packet: missing or invalid generatedAt");
  }
  if (!p.officeProjection || typeof p.officeProjection !== "object") {
    throw new Error("Invalid packet: missing officeProjection");
  }

  const projection = p.officeProjection as Record<string, unknown>;
  if (!projection.scene || typeof projection.scene !== "object") {
    throw new Error("Invalid packet: missing officeProjection.scene");
  }

  const scene = projection.scene as Record<string, unknown>;
  if (!Array.isArray(scene.agents)) {
    throw new Error("Invalid packet: missing officeProjection.scene.agents");
  }

  return packet as ProjectionBootstrapPacket;
}

/**
 * Check if operator bootstrap is configured.
 */
export function isOperatorBootstrapConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_PROJECTION_BOOTSTRAP_URL ||
    import.meta.env.VITE_PROJECTION_BOOTSTRAP_PATH,
  );
}
