import type { ImageProvider } from "./types";

const registry = new Map<string, ImageProvider>();

export function register(provider: ImageProvider): void {
  registry.set(provider.id, provider);
}

export function get(id: string): ImageProvider | undefined {
  return registry.get(id);
}

export function list(): Array<{ id: string; name: string }> {
  return Array.from(registry.values()).map(({ id, name }) => ({ id, name }));
}
