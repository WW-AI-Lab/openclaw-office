declare module "node:path" {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
  export function relative(from: string, to: string): string;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module "node:fs/promises" {
  export interface Dirent {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }
  export interface Stats {
    size: number;
    mtimeMs: number;
    mtime: Date;
  }
  export function readFile(path: string, encoding: string): Promise<string>;
  export function writeFile(path: string, data: string, encoding: string): Promise<void>;
  export function readdir(path: string): Promise<string[]>;
  export function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<Dirent[]>;
  export function unlink(path: string): Promise<void>;
  export function access(path: string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function rmdir(path: string): Promise<void>;
  export function stat(path: string): Promise<Stats>;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:os" {
  export function homedir(): string;
}

declare module "node:child_process" {
  interface ExecFileOptions {
    timeout?: number;
    encoding?: string;
  }
  export function execFile(
    file: string,
    args: string[],
    options: ExecFileOptions,
    callback: (err: Error | null, stdout: string, stderr: string) => void,
  ): void;
}

interface ImportMeta {
  url: string;
}

interface URL {
  protocol: string;
  host: string;
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
}

interface URLSearchParams {
  get(name: string): string | null;
}

declare const URL: {
  prototype: URL;
  new(input: string, base?: string | URL): URL;
};

declare const process: {
  env: Record<string, string | undefined>;
};

declare const Buffer: {
  concat(list: Buffer[]): Buffer;
  byteLength(str: string): number;
};

interface Buffer {
  toString(encoding: string): string;
}
