/**
 * Creates that the server has not confirmed yet. A request that uses such an id (moving a new bit,
 * linking it, putting it into a packet) must wait for the create, or the server answers 404.
 */
const pending = new Map<string, Promise<unknown>>()

export function trackCreate(id: string, request: Promise<unknown>): void {
  pending.set(id, request)
  const forget = () => {
    if (pending.get(id) === request) pending.delete(id)
  }
  request.then(forget, forget)
}

/** Resolves once every given id exists on the server; rejects if one of the creates failed. */
export async function whenCreated(...ids: (string | null | undefined)[]): Promise<void> {
  await Promise.all(ids.map((id) => (id ? pending.get(id) : undefined)))
}

export function resetPendingCreates(): void {
  pending.clear()
}
