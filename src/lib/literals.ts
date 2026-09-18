// PDNC cells contain Python list/set literals. Parse data only; never eval it.
export function parseLiteral(input: string): unknown {
  let i = 0;
  const whitespace = () => { while (/\s/.test(input[i] ?? '') && i < input.length) i++; };
  function value(): unknown {
    whitespace();
    const char = input[i++];
    if (char === '[' || char === '{') {
      const result: unknown[] = [], close = char === '[' ? ']' : '}';
      whitespace();
      if (input[i] === close) { i++; return result; }
      while (i < input.length) {
        result.push(value()); whitespace();
        if (input[i] === close) { i++; return result; }
        if (input[i++] !== ',') throw new Error('Invalid collection separator');
        whitespace();
        if (input[i] === close) { i++; return result; }
      }
      throw new Error('Unterminated collection');
    }
    if (char === "'" || char === '"') {
      let result = '';
      while (i < input.length) {
        const c = input[i++];
        if (c === char) return result;
        if (c !== '\\') { result += c; continue; }
        const escaped = input[i++];
        const simple: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
        if (!(escaped in simple)) throw new Error(`Unsupported escape at ${i}`);
        result += simple[escaped];
      }
      throw new Error('Unterminated string');
    }
    i--;
    const number = /^-?\d+/.exec(input.slice(i));
    if (number) { i += number[0].length; return Number(number[0]); }
    throw new Error(`Unsupported literal at ${i}`);
  }
  const result = value(); whitespace();
  if (i !== input.length) throw new Error('Trailing literal content');
  return result;
}
