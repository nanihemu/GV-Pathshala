// Models sometimes wrap JSON in code fences or add a sentence before it. This finds the JSON object.
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON object in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}
