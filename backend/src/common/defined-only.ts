/**
 * Drops keys whose value is undefined. A validated DTO class carries an own key (value
 * undefined) for every field missing in the request body, so Object.keys(dto).length is no
 * emptiness check. TypeORM skips undefined values and throws when none are left.
 */
export function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}
