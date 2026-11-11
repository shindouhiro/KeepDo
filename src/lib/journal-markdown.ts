import MarkdownIt from 'markdown-it'
import type { Token } from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

// 仅加载常用语法，避免将所有语言打入前端产物。
for (const [name, language] of Object.entries({ bash, css, javascript, json, python, sql, typescript, xml, yaml })) {
  hljs.registerLanguage(name, language)
}
hljs.registerAliases('vue', { languageName: 'xml' })

// 仅解析 Markdown 语法：关闭原始 HTML，并保留解析器默认的危险 URL 校验。
const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  highlight(code, language) {
    const name = language.toLowerCase()
    // 未知语言（含 text / plaintext）交回解析器转义，不把原文当作 HTML。
    if (name && !hljs.getLanguage(name)) return ''
    return name
      ? hljs.highlight(code, { language: name, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value
  },
})
const renderImage = markdown.renderer.rules.image!
markdown.renderer.rules.image = (tokens, index, options, env, renderer) => {
  tokens[index]!.attrSet('loading', 'lazy')
  tokens[index]!.attrSet('decoding', 'async')
  return renderImage(tokens, index, options, env, renderer)
}
markdown.renderer.rules.table_open = (tokens, index, options, _env, renderer) => {
  const id = markdown.utils.escapeHtml(`${tokens[index]!.attrGet('id')}-scroll`)
  return `<div id="${id}" class="journal-markdown-table" tabindex="0" role="region" aria-label="表格，可横向滚动">${renderer.renderToken(tokens, index, options)}`
}
markdown.renderer.rules.table_close = () => '</table></div>\n'

export function renderJournalMarkdown(content: string, idPrefix: string): string {
  const tokens = markdown.parse(content, {})
  let linkIndex = 0
  let tableIndex = 0
  function prepare(items: Token[]) {
    for (const token of items) {
      if (token.type === 'link_open') {
        token.attrSet('id', `${idPrefix}-link-${++linkIndex}`)
        token.attrSet('target', '_blank')
        token.attrSet('rel', 'noopener noreferrer')
      }
      if (token.type === 'table_open') token.attrSet('id', `${idPrefix}-table-${++tableIndex}`)
      if (token.children) prepare(token.children)
    }
  }
  prepare(tokens)
  return markdown.renderer.render(tokens, markdown.options, {})
}
