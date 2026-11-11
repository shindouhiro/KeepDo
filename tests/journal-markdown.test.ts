import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderJournalMarkdown } from '../src/lib/journal-markdown.ts'

test('日记渲染标题、强调、列表、引用、代码和表格', () => {
  const html = renderJournalMarkdown('# 今日收获\n\n**重点**、*想法*、~~删去~~与 `const x = 1`\n\n- 阅读\n- 运动\n\n1. 复习\n2. 总结\n\n> 每天进步\n\n```ts\nconst x = 1\n```\n\n| 事项 | 进度 |\n| --- | --- |\n| 阅读 | 完成 |', 'entry-1')
  for (const tag of ['h1', 'strong', 'em', 's', 'ul', 'ol', 'blockquote', 'code', 'pre', 'table', 'th', 'td']) {
    assert.match(html, new RegExp(`<${tag}(?:\\s|>)`))
  }
  assert.match(html, /class="language-ts"/)
  assert.match(html, /id="entry-1-table-1-scroll"/)
  assert.match(html, /tabindex="0"/)
})

test('普通文字保留中文、段落及单行换行，空内容不产生排版', () => {
  assert.equal(renderJournalMarkdown('今天读书\n记下一点收获\n\n明天继续', 'plain'), '<p>今天读书<br>\n记下一点收获</p>\n<p>明天继续</p>\n')
  assert.equal(renderJournalMarkdown('', 'empty'), '')
  assert.equal(renderJournalMarkdown('   ', 'empty'), '')
})

test('原始 HTML 和代码块中的恶意标签只显示文字', () => {
  const html = renderJournalMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n\n```html\n<iframe src="evil"></iframe>\n```', 'unsafe')
  assert.doesNotMatch(html, /<(?:script|img|iframe)\b/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /&lt;iframe/)
})

test('JavaScript、TypeScript 与 JSX 别名按语法区分颜色，并保留代码原文', () => {
  const code = '// 计数器\nfunction Counter() {\n  const count = 1;\n  const label = "次数";\n  return <div>{label + count}</div>;\n}'
  for (const language of ['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'JS']) {
    const html = renderJournalMarkdown(`\`\`\`${language}\n${code}\n\`\`\``, 'highlight')
    for (const token of ['keyword', 'title', 'string', 'number', 'comment', 'tag']) {
      assert.match(html, new RegExp(`class="hljs-${token}(?:[ "]|$)`))
    }
    const restored = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)![1]!
      .replace(/<\/?span\b[^>]*>/g, '')
      .replace(/&(lt|gt|quot|#x27|amp);/g, entity => ({ '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&amp;': '&' })[entity]!)
    assert.equal(restored, `${code}\n`)
  }
})

test('未标注语言的代码块自动识别，未知语言和纯文本安全回退', () => {
  const code = 'const count = 1;\nconsole.log("收获");'
  assert.match(renderJournalMarkdown(`\`\`\`\n${code}\n\`\`\``, 'auto'), /class="hljs-keyword"/)
  for (const language of ['unknown-language', 'text', 'plaintext', 'txt']) {
    const html = renderJournalMarkdown(`\`\`\`${language}\n<script>alert("x")</script>\n\`\`\``, 'plain-code')
    assert.doesNotMatch(html, /hljs-|<script>/)
    assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
  }
  assert.equal(renderJournalMarkdown('`const count = 1`', 'inline'), '<p><code>const count = 1</code></p>\n')
})

test('常用语言生成高亮标记，带恶意内容的高亮结果保持转义', () => {
  for (const [language, code] of [
    ['json', '{"count": 1}'],
    ['python', 'def counter():\n    return 1'],
    ['css', '.counter { color: red; }'],
    ['sql', 'SELECT * FROM users WHERE id = 1;'],
    ['bash', 'echo "收获"'],
    ['yaml', 'count: 1'],
    ['vue', '<template><div>收获</div></template>'],
  ]) {
    assert.match(renderJournalMarkdown(`\`\`\`${language}\n${code}\n\`\`\``, 'languages'), /class="hljs-/)
  }
  for (const language of ['html', 'js', '']) {
    const html = renderJournalMarkdown(`\`\`\`${language}\nconst payload = '</code><script>alert(1)</script><img src=x onerror=alert(1)>';\n\`\`\``, 'unsafe-highlight')
    assert.doesNotMatch(html, /<(?:script|img)\b|\sonerror="/i)
    assert.match(html.replace(/<\/?span\b[^>]*>/g, ''), /&lt;script&gt;/)
  }
})

test('危险 URL 与事件属性不能生成可执行链接或图片', () => {
  const html = renderJournalMarkdown('[脚本](javascript:alert%281%29)\n[实体](jav&#x61;script:alert%281%29)\n[文件](file:///etc/passwd)\n[脚本](vbscript:msgbox%281%29)\n![危险图片](data:image/svg+xml;base64,PHN2Zz4=)\n![图片](https://example.com/a.png "\" onerror=\"alert(1)")', 'unsafe')
  assert.doesNotMatch(html, /(?:href|src)="(?:javascript|vbscript|file|data):/i)
  assert.doesNotMatch(html, /\sonerror="/i)
})

test('链接和图片正常渲染，链接 ID 在记录和预览之间唯一', () => {
  const source = '[资料](https://example.com) [邮件](mailto:hello@example.com)\n\n![示意图](https://example.com/image.png)'
  const first = renderJournalMarkdown(source, 'entry-1')
  const second = renderJournalMarkdown(source, 'preview-1')
  assert.match(first, /id="entry-1-link-1"/)
  assert.match(first, /id="entry-1-link-2"/)
  assert.match(second, /id="preview-1-link-1"/)
  assert.match(first, /target="_blank" rel="noopener noreferrer"/)
  assert.match(first, /alt="示意图"/)
  assert.match(first, /loading="lazy"/)
  assert.match(first, /decoding="async"/)
  assert.doesNotMatch(renderJournalMarkdown('[链接](https://example.com)', '\" onclick=\"alert(1)'), /\sonclick="/)
})
