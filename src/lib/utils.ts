import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function unwrap<T>(
  call: Promise<{ status: "ok"; data: T } | { status: "error"; error: string }>
): Promise<T> {
  const result = await call;
  if (result.status === "error") throw new Error(result.error);
  return result.data;
}
