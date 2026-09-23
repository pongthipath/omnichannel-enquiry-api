# -*- coding: utf-8 -*-
"""Markdown -> print-ready HTML (Mermaid rendered client side, Thai web font, page rules)."""
import io, json, re, sys

src, out = sys.argv[1], sys.argv[2]
md = io.open(src, encoding='utf-8').read()

# pull the mermaid blocks out so the markdown renderer never sees them
diagrams = []
def stash(m):
    diagrams.append(m.group(1))
    return '\n<div class="mermaid-slot" data-i="%d"></div>\n' % (len(diagrams) - 1)
md = re.sub(r'```mermaid\n(.*?)\n```', stash, md, flags=re.S)

HTML = """<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<title>Omnichannel Customer Enquiry Management System</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai+Looped:wght@400;600;700&family=Noto+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  :root { --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --accent:#3758f9; --code-bg:#f6f8fa; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Thai Looped','Noto Sans','Leelawadee UI',Tahoma,sans-serif;
    font-size: 10.5pt; line-height: 1.75; color: var(--ink); margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1, h2, h3 { line-height: 1.35; break-after: avoid; page-break-after: avoid; }
  h1 { font-size: 21pt; margin: 0 0 4pt; letter-spacing: -.01em; }
  h2 { font-size: 15pt; margin: 22pt 0 8pt; padding-bottom: 5pt; border-bottom: 2px solid var(--line); break-before: auto; }
  h3 { font-size: 12pt; margin: 15pt 0 5pt; color: #111827; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 20pt; margin: 6pt 0; }
  li { margin: 3pt 0; }
  a { color: var(--accent); text-decoration: none; }
  hr { border: none; border-top: 1px solid var(--line); margin: 16pt 0; }
  code { font-family: 'JetBrains Mono',Consolas,monospace; font-size: 9pt; background: var(--code-bg);
         padding: 1px 4px; border-radius: 3px; }
  pre { background: var(--code-bg); border: 1px solid var(--line); border-radius: 6px; padding: 9pt 11pt;
        overflow-x: auto; break-inside: avoid; page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 8.6pt; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.3pt;
          break-inside: avoid; page-break-inside: avoid; }
  th, td { border: 1px solid var(--line); padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
  blockquote { margin: 8pt 0; padding: 6pt 12pt; border-left: 3px solid var(--accent); background: #f8faff; }
  blockquote p { margin: 3pt 0; }
  .mermaid-slot { margin: 12pt 0; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .mermaid-slot svg { max-width: 100%; height: auto; }
  strong { font-weight: 600; }
</style></head>
<body><article id="doc"></article>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
const markdown = __MD__;
const diagrams = __DIAGRAMS__;
document.getElementById('doc').innerHTML = marked.parse(markdown);
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  fontFamily: "'Noto Sans Thai Looped','Noto Sans',sans-serif",
  themeVariables: { primaryColor:'#eef2ff', primaryTextColor:'#1f2937', primaryBorderColor:'#3758f9',
                    lineColor:'#6b7280', fontSize:'13px' },
});
for (const slot of document.querySelectorAll('.mermaid-slot')) {
  const i = Number(slot.dataset.i);
  try {
    const { svg } = await mermaid.render('mmd' + i, diagrams[i]);
    slot.innerHTML = svg;
  } catch (e) {
    slot.innerHTML = '<pre>' + diagrams[i] + '</pre>';
  }
}
await document.fonts.ready;
window.__READY__ = true;
</script></body></html>"""

html = HTML.replace('__MD__', json.dumps(md)).replace('__DIAGRAMS__', json.dumps(diagrams))
io.open(out, 'w', encoding='utf-8').write(html)
print('html written, %d diagrams' % len(diagrams))

# Turn the HTML into a PDF (Chrome/Edge headless, Thai text stays selectable):
#   npm run docs:pdf
#   chrome --headless=new --disable-gpu --virtual-time-budget=45000 \
#          --print-to-pdf=docs/submission.pdf --print-to-pdf-no-header docs/submission.html
