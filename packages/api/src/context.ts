import type { Request } from "express";

interface CreateContextOptions {
  req: Request;
}

export async function createContext(_opts: CreateContextOptions) {
  return {
    auth: null,
    session: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
