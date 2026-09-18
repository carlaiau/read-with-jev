/** Display cleanup only: source metadata, edition IDs, and permalinks stay intact. */
export function displayBookTitle(title: string): string {
  return title
    .replace(/\s*[·|]\s*(?:Project\s+)?Gutenberg\s*\d+\s*$/i, '')
    .replace(/\bProject\s+Gutenberg(?:['’]s)?\s+/gi, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[_*]/g, '')
    .replace(/\s+/g, ' ').trim();
}

export function displayCharacterName(character: { name: string; scope?: string }): string {
  const suffix = character.scope ? ` · ${character.scope}` : '';
  return suffix && character.name.endsWith(suffix)
    ? character.name.slice(0, -suffix.length)
    : character.name;
}
