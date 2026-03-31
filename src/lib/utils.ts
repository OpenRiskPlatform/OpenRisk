import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function unwrap<T>(
  call: Promise<{ status: "ok"; data: T } | { status: "error"; error: unknown }>
): Promise<T> {
  const result = await call;
  if (result.status === "error") {
    const err = result.error;
    if (typeof err === "string") throw new Error(err);
    if (err && typeof err === "object" && "message" in err) throw new Error(String((err as { message: unknown }).message));
    throw new Error(JSON.stringify(err));
  }
  return result.data;
}
