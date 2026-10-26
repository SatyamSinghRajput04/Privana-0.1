import React, { Fragment } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Self-contained Markdown renderer — no external deps.
// Supports: headings, bold, italic, inline-code, code-blocks, tables,
// bullet/numbered lists, blockquotes, horizontal rules, emoji pass-through.
// ─────────────────────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  text: string;
  style?: React.CSSProperties;
}

export function MarkdownRenderer({ text, style }: MarkdownRendererProps) {
  const renderInline = (raw: string, key: string | number): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0, m: RegExpExecArray | null;
    let idx = 0;
    while ((m = pattern.exec(raw)) !== null) {
      if (m.index > last) parts.push(<Fragment key={`${key}-t${idx++}`}>{raw.slice(last, m.index)}</Fragment>);
      const token = m[0];
      if (token.startsWith('`')) {
        parts.push(
          <code key={`${key}-c${idx++}`} style={{
            background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
            borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--mono, monospace)',
            fontSize: '0.88em', border: '1px solid rgba(239,68,68,0.2)'
          }}>{token.slice(1, -1)}</code>
        );
      } else if (token.startsWith('**')) {
        parts.push(<strong key={`${key}-b${idx++}`} style={{ color: '#f4f4f5', fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
      } else {
        parts.push(<em key={`${key}-i${idx++}`} style={{ color: '#d4d4d8', fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
      }
      last = m.index + token.length;
    }
    if (last < raw.length) parts.push(<Fragment key={`${key}-te${idx++}`}>{raw.slice(last)}</Fragment>);
    return parts.length === 1 ? parts[0] : <Fragment key={key}>{parts}</Fragment>;
  };

  const lines = (text || '').split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={i} style={{
          background: '#0d0d14', border: '1px solid #27272a', borderRadius: 6,
          padding: '0.6rem 0.8rem', overflowX: 'auto', margin: '0.4rem 0',
          fontFamily: 'var(--mono, monospace)', fontSize: '0.72rem', color: '#a1a1aa', lineHeight: 1.6
        }}><code>{codeLines.join('\n')}</code></pre>
      );
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #27272a', margin: '0.5rem 0' }} />);
      i++; continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = ['0.95rem','0.88rem','0.82rem'];
      const colors = ['#f4f4f5','#e4e4e7','#d4d4d8'];
      nodes.push(
        <div key={i} style={{
          fontSize: sizes[level-1], fontWeight: 700, color: colors[level-1],
          marginTop: level === 1 ? '0.7rem' : level === 2 ? '0.55rem' : '0.4rem',
          marginBottom: '0.2rem',
          ...(level === 1 ? { borderBottom: '1px solid #27272a', paddingBottom: '0.2rem' } : {})
        }}>{renderInline(hMatch[2], `h-${i}`)}</div>
      );
      i++; continue;
    }

    // Table detection: line with pipes
    if (line.includes('|') && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        const raw = lines[i];
        const cells = raw.split('|').map(c => c.trim());
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        const isSep = cells.every(c => /^:?-+:?$/.test(c));
        if (!isSep) tableRows.push(cells);
        i++;
      }
      const headers = tableRows[0] || [];
      const bodyRows = tableRows.slice(1);
      nodes.push(
        <div key={i} style={{ overflowX: 'auto', margin: '0.4rem 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.7rem' }}>
            <thead>
              <tr style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1.5px solid rgba(239,68,68,0.25)' }}>
                {headers.map((h, ci) => (
                  <th key={ci} style={{
                    padding: '4px 10px', textAlign: 'left', color: '#f4f4f5',
                    fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.68rem'
                  }}>{renderInline(h, `th-${i}-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #1a1a24', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '3.5px 10px', color: '#a1a1aa', verticalAlign: 'top', fontSize: '0.68rem' }}>
                      {renderInline(cell, `td-${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        bqLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      nodes.push(
        <div key={i} style={{
          borderLeft: '3px solid rgba(239,68,68,0.5)', paddingLeft: '0.65rem',
          color: '#a1a1aa', margin: '0.3rem 0', fontStyle: 'italic', fontSize: '0.7rem'
        }}>
          {bqLines.map((bl, bi) => <div key={bi}>{renderInline(bl, `bq-${i}-${bi}`)}</div>)}
        </div>
      );
      continue;
    }

    // Bullet list
    if (/^[\-\*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*•]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} style={{ paddingLeft: '1.1rem', margin: '0.2rem 0', listStyle: 'none' }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: '#a1a1aa', fontSize: '0.7rem', lineHeight: 1.6, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '-0.9rem', color: '#ef4444', fontWeight: 700 }}>•</span>
              {renderInline(item, `li-${i}-${ii}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol key={i} style={{ paddingLeft: '1.3rem', margin: '0.2rem 0' }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: '#a1a1aa', fontSize: '0.7rem', lineHeight: 1.6 }}>
              {renderInline(item, `ol-${i}-${ii}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line -> spacer
    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: '0.3rem' }} />);
      i++; continue;
    }

    // Plain paragraph
    nodes.push(
      <div key={i} style={{ color: '#a1a1aa', fontSize: '0.72rem', lineHeight: 1.6 }}>
        {renderInline(line, `p-${i}`)}
      </div>
    );
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', ...style }}>{nodes}</div>;
}

export default MarkdownRenderer;
