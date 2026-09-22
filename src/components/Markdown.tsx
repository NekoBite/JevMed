import { Fragment, type ReactNode } from 'react'

/**
 * A deliberately small Markdown subset: paragraphs, bullet lists, **bold**,
 * _italic_ and `code`. Rendered into React elements rather than injected HTML,
 * so model output can never introduce markup into the page. Anything the
 * renderer does not understand simply shows as the text it is.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={key} className="font-mono text-[0.9em] bg-canvas px-1.5 py-0.5 rounded">{tok.slice(1, -1)}</code>)
    else out.push(<em key={key} className="text-ink-soft">{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let list: string[] = []
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    const items = list
    list = []
    blocks.push(
      <ul key={`ul-${key++}`} className="list-disc pl-6 space-y-1.5 my-3">
        {items.map((li, i) => <li key={i}>{inline(li, `li-${i}`)}</li>)}
      </ul>,
    )
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^[-*]\s+/.test(line)) { list.push(line.replace(/^[-*]\s+/, '')); continue }
    flushList()
    if (line.trim() === '') continue
    if (/^#{1,4}\s+/.test(line)) {
      blocks.push(<h4 key={`h-${key++}`} className="font-bold mt-4 mb-1.5">{inline(line.replace(/^#{1,4}\s+/, ''), `h-${key}`)}</h4>)
      continue
    }
    blocks.push(<p key={`p-${key++}`} className="my-2.5 leading-relaxed">{inline(line, `p-${key}`)}</p>)
  }
  flushList()

  return <Fragment>{blocks}</Fragment>
}
