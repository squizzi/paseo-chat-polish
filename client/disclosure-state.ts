/**
 * Tab switches can unmount timeline rows. Keep an explicit disclosure choice
 * outside the row so a remount restores the same view instead of treating it
 * like a newly opened detail.
 */
const remembered = new Map<string, boolean>();
const MAX_REMEMBERED = 2000;

export function recallDisclosure(key: string | undefined, initial: boolean) {
  const value = key === undefined ? undefined : remembered.get(key);
  return value === undefined ? { open: initial, restored: false } : { open: value, restored: true };
}

export function rememberDisclosure(key: string | undefined, open: boolean) {
  if (key === undefined) return;
  // Reinsert touched entries so the cap removes the least-recently-used row.
  remembered.delete(key);
  remembered.set(key, open);
  if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.keys().next().value!);
}
