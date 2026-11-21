/**
 * Text helpers every layer needs. They live in `domain` because the engine modules, the state layer
 * and the UI all render the same phrases, and a second copy of a joiner is how two parts of one
 * document start wording the same list differently.
 */

/** `'a'`, `'a and b'`, `'a, b and c'` - a list of labels as one readable sentence fragment. */
export function joinList(parts: readonly string[]): string {
  const last = parts.at(-1);
  if (last === undefined) {
    return '';
  }
  return parts.length === 1 ? last : `${parts.slice(0, -1).join(', ')} and ${last}`;
}
