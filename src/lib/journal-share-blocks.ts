import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false })

export type JournalShareBlock = { id: string; title: string; content: string }

export function journalShareBlocks(content: string): JournalShareBlock[] {
  // 行偏移使用原文计算，保留 CRLF，确保分享片段始终是原文连续子串。
  const offsets = [0]
  for (const match of content.matchAll(/\r\n|\r|\n/g)) offsets.push(match.index + match[0].length)
  const tokens = markdown.parse(content, {})
  const headings = tokens.flatMap((token, index) => token.type === 'heading_open' && token.level === 0 && token.map
    ? [{ line: token.map[0], level: Number(token.tag.slice(1)), title: tokens[index + 1]?.content || '未命名章节' }]
    : [])
  const ranges: { start: number; end: number; title?: string }[] = []
  // 标题前的引言或无标题记录，按完整顶层块划分，列表和代码不会被拆散。
  const introductionEnd = headings[0]?.line ?? Infinity
  for (const token of tokens) {
    if (token.level === 0 && token.map && token.nesting !== -1 && token.map[0] < introductionEnd)
      ranges.push({ start: token.map[0], end: token.map[1] })
  }
  headings.forEach((heading, index) => {
    const next = headings.slice(index + 1).find(item => item.level <= heading.level)
    ranges.push({ start: heading.line, end: next?.line ?? offsets.length, title: heading.title })
  })
  return ranges.map(range => {
    const text = content.slice(offsets[range.start], offsets[range.end] ?? content.length).trim()
    return { id: `block-${range.start}`, title: range.title ?? text.split(/\r?\n/)[0]!.slice(0, 60), content: text }
  }).filter(block => block.content)
}
