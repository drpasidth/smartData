// Minimal Markdown -> HTML renderer for the in-app user manual.
// Supports headings, paragraphs, bullet/numbered lists, tables, fenced code,
// horizontal rules, **bold**, `code`, [links](url) and anchors.
// All text is HTML-escaped first, so the source cannot inject markup.

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

function inline(text) {
  const codes = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      // Only allow in-page anchors and http(s) links.
      const safe = href.startsWith('#') || /^https?:\/\//.test(href);
      return safe ? `<a href="${href}"${href.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${label}</a>` : label;
    });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

export const manualStyles = `
body{margin:0;background:#f7f7f5;color:#1f2328;font:16px/1.65 "Segoe UI","Noto Sans Thai",system-ui,sans-serif}
.manual{max-width:960px;margin:0 auto;padding:32px 24px 64px;background:#fff;min-height:100vh;box-sizing:border-box}
h1{font-size:2rem;margin:.2em 0 .5em;border-bottom:2px solid #7168e8;padding-bottom:.3em}
h2{font-size:1.4rem;margin:1.8em 0 .5em;color:#292a3b;border-bottom:1px solid #e5e5ea;padding-bottom:.25em}
h3{font-size:1.1rem;margin:1.4em 0 .4em;color:#292a3b}
p,li{max-width:80ch}
code{background:#f0eefc;padding:1px 5px;border-radius:4px;font-size:.92em}
pre{background:#1f2328;color:#f0f0f0;padding:12px 14px;border-radius:8px;overflow:auto}
pre code{background:none;padding:0;color:inherit}
blockquote{margin:1em 0;padding:.6em 1em;border-left:4px solid #7168e8;background:#f7f6fe;color:#3b3f4a}
.table-wrap{overflow-x:auto;margin:1em 0}
table{border-collapse:collapse;width:100%;font-size:.95rem}
th,td{border:1px solid #dcdce3;padding:7px 10px;text-align:left;vertical-align:top}
th{background:#f3f2fb}
hr{border:0;border-top:1px solid #e5e5ea;margin:2em 0}
a{color:#5b4fd6}
@media print{body{background:#fff}.manual{padding:0}}
@media(max-width:560px){.manual{padding:20px 14px}h1{font-size:1.6rem}}
`;

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) { i++; continue; }

    if (/^-{3,}\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level} id="${slugify(heading[2])}">${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      html.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      html.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      html.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s|>|\s*\||-{3,}\s*$)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    else i++;
  }

  return html.join('\n');
}
