/**
 * antigravity-codex-theme · User Custom Runtime Hook (Hot-Reloaded)
 * 架构图自动识别与增强：
 *   - ASCII (+---+) & Unicode (┌───┐) 框图统一 2:1 中英边框自动对齐与自适应扩宽（支持并排多盒与盒间连线如 ─G1►）
 *   - ASCII 框图平滑转 Unicode 制表线 + 极客分层着色
 *   - 宽图自适应紧凑字号 + 禁止折行横向滚动
 */
(function () {
  const WRAP_CLASS = 'ag-ascii-diagram-wrap';
  const HIDDEN_CLASS = 'ag-ascii-src-hidden';
  const ATTR_SIG = 'data-ag-ascii-sig';

  function isWideChar(ch) {
    if (!ch) return false;
    const cp = ch.codePointAt(0);
    return (
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0x303e) ||
      (cp >= 0x3041 && cp <= 0x33ff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x4e00 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe6f) ||
      (cp >= 0xff01 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x20000 && cp <= 0x2fffd)
    );
  }

  function dispWidth(str) {
    let w = 0;
    for (const ch of str) w += isWideChar(ch) ? 2 : 1;
    return w;
  }

  function detectDiagramKind(text) {
    if (!text || text.length < 30 || text.length > 40000) return null;
    const lines = text.split('\n');
    if (lines.length < 3) return null;

    let asciiBorders = 0;
    let asciiPipes = 0;
    let uniBorders = 0;
    let uniPipes = 0;

    for (const line of lines) {
      if (/\+[-=]{3,}\+/.test(line)) asciiBorders++;
      if (/\|.*\|/.test(line)) asciiPipes++;
      if (/[┌┏╔└┗╚├┣╠][─━═]{2,}[┐┓╗┘┛╝┤┫╣]/.test(line)) uniBorders++;
      if (/[│┃║]/.test(line)) uniPipes++;
    }

    if (asciiBorders >= 2 && asciiPipes >= 1) return 'ascii';
    if (uniBorders >= 2 && uniPipes >= 1) return 'unicode';
    return null;
  }

  // Parse box borders on a horizontal border line (supports both ASCII `+---+` and Unicode `┌───┐` / `└───┘`)
  function parseBorderBoxes(line, kind) {
    const boxes = [];
    const re =
      kind === 'ascii'
        ? /\+[-=+]{2,}\+/g
        : /[┌┏╔└┗╚├┣╠][─━═┬┴┼┳┻╋╦╩╬]{2,}[┐┓╗┘┛╝┤┫╣]/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const prefix = line.slice(0, m.index);
      const start = dispWidth(prefix);
      const width = dispWidth(m[0]);
      boxes.push({ start, end: start + width - 1, raw: m[0] });
    }
    return boxes.length > 0 ? boxes : null;
  }

  function isBorderOnlyLine(line, kind) {
    if (kind === 'ascii') return /^\s*(?:\+[-=+]{2,}\+\s*)+$/.test(line);
    return /^\s*(?:[┌┏╔└┗╚├┣╠][─━═┬┴┼┳┻╋╦╩╬]{2,}[┐┓╗┘┛╝┤┫╣]\s*)+$/.test(line);
  }

  function expandBorderRaw(raw, extra, kind) {
    if (extra <= 0) return raw;
    const fill = kind === 'ascii' ? '-' : raw.includes('═') ? '═' : raw.includes('━') ? '━' : '─';
    return raw.slice(0, -1) + fill.repeat(extra) + raw.slice(-1);
  }

  // Split an interior row into box contents + inter-box connectors + trailing suffix (e.g. `─G3`)
  function parseInteriorRow(line, boxCount, pipeChar) {
    const indices = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] === pipeChar) indices.push(i);
    }
    if (indices.length !== boxCount * 2) return null;

    const cells = [];
    const gaps = [];
    for (let i = 0; i < boxCount; i++) {
      const rawCell = line.slice(indices[i * 2] + 1, indices[i * 2 + 1]);
      cells.push(rawCell.replace(/\s+$/, ''));
      if (i < boxCount - 1) {
        gaps.push(line.slice(indices[i * 2 + 1] + 1, indices[(i + 1) * 2]));
      }
    }
    const suffix = line.slice(indices[indices.length - 1] + 1).replace(/\s+$/, '');
    return { cells, gaps, suffix };
  }

  // Unified auto-realigner for BOTH ASCII (`+---+` / `|`) and Unicode (`┌───┐` / `│`) box bands
  function realignBoxes(lines, kind) {
    const out = lines.slice();
    const pipeChar = kind === 'ascii' ? '|' : '│';
    const borderBoxes = out.map((l) => (isBorderOnlyLine(l, kind) ? parseBorderBoxes(l, kind) : null));

    const bands = [];
    let r = 0;
    while (r < out.length) {
      if (borderBoxes[r]) {
        const topRow = r;
        const topBoxes = borderBoxes[r];
        let cur = r + 1;
        const bodyRows = [];
        while (cur < out.length && !borderBoxes[cur] && out[cur].includes(pipeChar)) {
          bodyRows.push(cur);
          cur++;
        }
        if (bodyRows.length > 0 && cur < out.length && borderBoxes[cur] && borderBoxes[cur].length === topBoxes.length) {
          bands.push({ topRow, bottomRow: cur, bodyRows, topBoxes, bottomBoxes: borderBoxes[cur] });
          r = cur + 1;
          continue;
        }
      }
      r++;
    }

    for (const band of bands) {
      const boxCount = band.topBoxes.length;
      const targetInner = band.topBoxes.map((b) => b.end - b.start - 1);
      const targetGaps = [];
      for (let i = 0; i < boxCount - 1; i++) {
        targetGaps.push(Math.max(2, band.topBoxes[i + 1].start - band.topBoxes[i].end - 1));
      }

      const parsedBody = [];
      for (const rowIdx of band.bodyRows) {
        const parsed = parseInteriorRow(out[rowIdx], boxCount, pipeChar);
        parsedBody.push(parsed);
        if (!parsed) continue;
        for (let i = 0; i < boxCount; i++) {
          const needed = dispWidth(parsed.cells[i]) + 1;
          if (needed > targetInner[i]) targetInner[i] = needed;
          if (i < boxCount - 1) {
            const gTrim = parsed.gaps[i].trim();
            if (gTrim) {
              const gNeed = dispWidth(gTrim);
              if (gNeed > targetGaps[i]) targetGaps[i] = gNeed;
            }
          }
        }
      }

      // Compute final [start, end] for each box in this band
      const finalBoxes = [];
      let curX = band.topBoxes[0].start;
      for (let i = 0; i < boxCount; i++) {
        const origInner = band.topBoxes[i].end - band.topBoxes[i].start - 1;
        const extra = targetInner[i] - origInner;
        const start = curX;
        const end = start + targetInner[i] + 1;
        finalBoxes.push({ start, end, extra, origStart: band.topBoxes[i].start });
        if (i < boxCount - 1) {
          curX = end + 1 + targetGaps[i];
        }
      }

      // If there's a label header line right above topRow (e.g. `PHASE-001 (...)  PHASE-002 (...)  PHASE-003 (...)`), align its columns too
      if (band.topRow > 0 && boxCount >= 2 && !borderBoxes[band.topRow - 1] && !out[band.topRow - 1].includes(pipeChar)) {
        const headerLine = out[band.topRow - 1];
        const chunks = [];
        const chunkRe = /\S+(?: \S+)*/g;
        let hm;
        while ((hm = chunkRe.exec(headerLine)) !== null) {
          chunks.push({ text: hm[0], col: dispWidth(headerLine.slice(0, hm.index)) });
        }
        if (chunks.length === boxCount) {
          let rebuilt = '';
          let cx = 0;
          let ok = true;
          for (let i = 0; i < boxCount; i++) {
            const target = finalBoxes[i].start;
            if (target < cx) {
              ok = false;
              break;
            }
            rebuilt += ' '.repeat(target - cx) + chunks[i].text;
            cx = target + dispWidth(chunks[i].text);
          }
          if (ok) out[band.topRow - 1] = rebuilt;
        }
      }

      // Rebuild top & bottom borders
      for (const [bRow, origBoxes] of [
        [band.topRow, band.topBoxes],
        [band.bottomRow, band.bottomBoxes]
      ]) {
        let rebuilt = '';
        let curCol = 0;
        for (let i = 0; i < boxCount; i++) {
          const fb = finalBoxes[i];
          rebuilt += ' '.repeat(Math.max(0, fb.start - curCol));
          const seg = expandBorderRaw(origBoxes[i].raw, fb.extra, kind);
          rebuilt += seg;
          curCol = fb.start + dispWidth(seg);
        }
        out[bRow] = rebuilt;
        borderBoxes[bRow] = parseBorderBoxes(rebuilt, kind);
      }

      // Rebuild every body row with exact 2:1 display-width padding & gap connectors
      for (let idx = 0; idx < band.bodyRows.length; idx++) {
        const rowIdx = band.bodyRows[idx];
        const parsed = parsedBody[idx];
        if (!parsed) continue;
        let rebuilt = ' '.repeat(finalBoxes[0].start);
        for (let i = 0; i < boxCount; i++) {
          const innerTarget = finalBoxes[i].end - finalBoxes[i].start - 1;
          const cw = dispWidth(parsed.cells[i]);
          rebuilt += pipeChar + parsed.cells[i] + ' '.repeat(Math.max(0, innerTarget - cw)) + pipeChar;
          if (i < boxCount - 1) {
            const gw = targetGaps[i];
            const gTrim = parsed.gaps[i].trim();
            if (!gTrim) {
              rebuilt += ' '.repeat(gw);
            } else {
              const gLen = dispWidth(gTrim);
              const pad = Math.max(0, gw - gLen);
              const leftPad = Math.floor(pad / 2);
              const rightPad = pad - leftPad;
              const isDashConn = /^[─━═-]/.test(gTrim);
              const fillCh = isDashConn ? '─' : ' ';
              if (isDashConn && /[►▶→]$/.test(gTrim)) {
                rebuilt += fillCh.repeat(pad) + gTrim;
              } else {
                rebuilt += fillCh.repeat(leftPad) + gTrim + fillCh.repeat(rightPad);
              }
            }
          }
        }
        if (parsed.suffix) rebuilt += parsed.suffix;
        out[rowIdx] = rebuilt;
      }
    }

    // Realign vertical connector lines between ASCII boxes
    if (kind === 'ascii') {
      for (let row = 1; row < out.length; row++) {
        if (borderBoxes[row] || /^\s*\|.*\|\s*$/.test(out[row])) continue;
        const prev = out[row - 1];
        const line = out[row];

        const prevAnchors = [];
        let col = 0;
        for (let i = 0; i < prev.length; i++) {
          const ch = prev[i];
          const w = isWideChar(ch) ? 2 : 1;
          if (ch === '|' || (ch === '+' && i > 0 && i < prev.length - 1 && prev[i - 1] === '-' && prev[i + 1] === '-')) {
            prevAnchors.push(col);
          }
          col += w;
        }
        if (prevAnchors.length === 0) continue;

        if (/^\s*[v^](?:\s+[v^])*\s*$/.test(line)) {
          const arrows = [];
          let c = 0;
          for (const ch of line) {
            if (ch === 'v' || ch === '^') arrows.push({ ch, col: c });
            c += isWideChar(ch) ? 2 : 1;
          }
          if (arrows.length === prevAnchors.length) {
            let rebuilt = '';
            let cur = 0;
            for (let i = 0; i < arrows.length; i++) {
              const target = prevAnchors[i];
              if (target >= cur) {
                rebuilt += ' '.repeat(target - cur) + arrows[i].ch;
                cur = target + 1;
              }
            }
            out[row] = rebuilt;
          }
        } else if (/^\s*\|/.test(line) && prevAnchors.length >= 2) {
          const parts = line.split('|');
          if (parts.length - 1 === prevAnchors.length) {
            let rebuilt = '';
            let cur = 0;
            let ok = true;
            for (let i = 0; i < prevAnchors.length; i++) {
              const target = prevAnchors[i];
              const label = parts[i + 1].replace(/\s+$/, '');
              if (target < cur) {
                ok = false;
                break;
              }
              rebuilt += ' '.repeat(target - cur) + '|' + label;
              cur = target + 1 + dispWidth(label);
            }
            if (ok) out[row] = rebuilt;
          }
        }
      }
    }

    return out;
  }

  function buildGrid(lines) {
    const grid = [];
    for (const line of lines) {
      const row = [];
      for (const ch of line) {
        row.push(ch);
        if (isWideChar(ch)) row.push(null);
      }
      grid.push(row);
    }
    return grid;
  }

  function upgradeAsciiToUnicode(rawText) {
    const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
    const lines = realignBoxes(rawLines, 'ascii');
    const grid = buildGrid(lines);
    const H = grid.length;

    const at = (r, c) => (r >= 0 && r < H && c >= 0 && c < grid[r].length ? grid[r][c] : ' ');
    const isHChar = (ch) => ch === '-' || ch === '=' || ch === '+';
    const isVChar = (ch) => ch === '|' || ch === '+' || ch === 'v' || ch === '^';
    const hasVertNear = (r, c, tol = 0) => {
      for (let dc = -tol; dc <= tol; dc++) {
        if (isVChar(at(r, c + dc))) return true;
      }
      return false;
    };

    const outLines = [];
    for (let r = 0; r < H; r++) {
      const row = grid[r];
      const chars = [];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === null) continue;

        if (ch === '+') {
          const l = isHChar(at(r, c - 1));
          const ri = isHChar(at(r, c + 1));
          const u = hasVertNear(r - 1, c, l !== ri ? 2 : 1);
          const d = hasVertNear(r + 1, c, l !== ri ? 2 : 1);
          const mask = (u ? 1 : 0) | (d ? 2 : 0) | (l ? 4 : 0) | (ri ? 8 : 0);
          const map = {
            10: '┌',
            6: '┐',
            9: '└',
            5: '┘',
            11: '├',
            7: '┤',
            14: '┬',
            13: '┴',
            15: '┼',
            12: '─',
            3: '│'
          };
          chars.push(map[mask] || '+');
        } else if (ch === '-') {
          const l = at(r, c - 1);
          const ri = at(r, c + 1);
          if ((l === '-' || l === '+') && (ri === '-' || ri === '+')) {
            chars.push('─');
          } else if ((l === '+' && ri === '-') || (l === '-' && ri === '+')) {
            chars.push('─');
          } else {
            chars.push('-');
          }
        } else if (ch === '|') {
          chars.push('│');
        } else if (
          ch === 'v' &&
          hasVertNear(r - 1, c, 1) &&
          at(r, c - 1) === ' ' &&
          (at(r, c + 1) === ' ' || c + 1 >= row.length)
        ) {
          chars.push('▼');
        } else if (
          ch === '^' &&
          hasVertNear(r + 1, c, 1) &&
          at(r, c - 1) === ' ' &&
          (at(r, c + 1) === ' ' || c + 1 >= row.length)
        ) {
          chars.push('▲');
        } else {
          chars.push(ch);
        }
      }
      outLines.push(chars.join(''));
    }
    return outLines.join('\n');
  }

  function normalizeUnicodeDiagram(rawText) {
    const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
    return realignBoxes(rawLines, 'unicode').join('\n');
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightTextSegment(seg) {
    const tokenRe =
      /(\b\d+\.\s+[\u4e00-\u9fffA-Za-z0-9_·/\- ]+?(?=\s{2,}|$)|\b(?:PHASE|STAGE|EPIC|LAYER|STEP|GATE)-\d+\b|\bG\d+\b)|(\b(?:TASK|PG|FE|BE|PR)-\d+\b|(?:[\w.-]+\/)+[\w.*{},-]+|\b[\w.-]+\.(?:ts|tsx|js|mjs|cjs|py|go|rs|json|md|sql|sh|yaml|yml|toml|lock)\b|\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b)|(\([^()]{1,42}\)|（[^（）]{1,42}）)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = tokenRe.exec(seg)) !== null) {
      if (m.index > last) out += escHtml(seg.slice(last, m.index));
      if (m[1]) {
        out += `<span class="ag-ad-title">${escHtml(m[1])}</span>`;
      } else if (m[2]) {
        out += `<span class="ag-ad-path">${escHtml(m[2])}</span>`;
      } else if (m[3]) {
        out += `<span class="ag-ad-note">${escHtml(m[3])}</span>`;
      }
      last = tokenRe.lastIndex;
    }
    if (last < seg.length) out += escHtml(seg.slice(last));
    return out;
  }

  function highlightLine(line) {
    const boxRe = /([┌┐└┘├┤┬┴┼─│┏┓┗┛┣┫┳┻╋━┃╔╗╚╝╠╣╦╩╬═║]+)|([▼▲◀▶→←↑↓►◄]+)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = boxRe.exec(line)) !== null) {
      if (m.index > last) {
        out += highlightTextSegment(line.slice(last, m.index));
      }
      if (m[1]) {
        out += `<span class="ag-ad-box">${escHtml(m[1])}</span>`;
      } else if (m[2]) {
        out += `<span class="ag-ad-arrow">${escHtml(m[2])}</span>`;
      }
      last = boxRe.lastIndex;
    }
    if (last < line.length) {
      out += highlightTextSegment(line.slice(last));
    }
    return out;
  }

  function renderDiagram(rawText, kind) {
    const normalized = kind === 'ascii' ? upgradeAsciiToUnicode(rawText) : normalizeUnicodeDiagram(rawText);
    const lines = normalized.split('\n');
    let maxCols = 0;
    for (const l of lines) {
      const w = dispWidth(l);
      if (w > maxCols) maxCols = w;
    }
    return {
      html: lines.map(highlightLine).join('\n'),
      maxCols
    };
  }

  function extractCodeText(el) {
    if (!el) return '';
    const codeLines = el.querySelectorAll('.code-line');
    if (codeLines.length >= 3) {
      return Array.from(codeLines, (n) => {
        const inner = n.querySelector('.line-content') || n;
        return (inner.textContent || '').replace(/\r?\n/g, '');
      }).join('\n');
    }
    const cmLines = el.querySelectorAll('.cm-line');
    if (cmLines.length >= 3) {
      return Array.from(cmLines, (n) => (n.textContent || '').replace(/\r?\n/g, '')).join('\n');
    }
    const codeEl = el.tagName === 'PRE' ? el.querySelector('code') || el : el;
    const raw = codeEl.textContent || '';
    if (raw.includes('\n')) return raw;
    return codeEl.innerText || raw;
  }

  function isExcludedElement(el) {
    if (!el || !el.isConnected || !el.parentElement) return true;
    if (el.closest('.' + WRAP_CLASS)) return true;
    if (
      el.closest(
        '.monaco-editor, .xterm, #ag-settings-pane, [contenteditable="true"], [data-lexical-editor="true"], [data-testid="user-message-content"], .agy-user-bubble'
      )
    ) {
      return true;
    }
    const cm = el.closest('.cm-editor');
    if (cm && cm.querySelector('[contenteditable="true"]')) return true;
    return false;
  }

  function enhanceTarget(el) {
    if (isExcludedElement(el)) return false;

    const rawText = extractCodeText(el);
    const kind = detectDiagramKind(rawText);
    if (!kind) {
      const next = el.nextElementSibling;
      if (next && next.classList.contains(WRAP_CLASS)) {
        next.remove();
        el.classList.remove(HIDDEN_CLASS);
        el.removeAttribute(ATTR_SIG);
      }
      return false;
    }

    const sig = kind + ':' + String(rawText.length) + ':' + rawText.slice(0, 48) + ':' + rawText.slice(-48);
    const existing = el.nextElementSibling;
    if (existing && existing.classList.contains(WRAP_CLASS) && el.getAttribute(ATTR_SIG) === sig) {
      return true;
    }

    const { html, maxCols } = renderDiagram(rawText, kind);
    const badgeLabel = kind === 'ascii' ? 'ASCII DIAGRAM · 2:1' : 'DIAGRAM · 2:1';
    let wrap = existing && existing.classList.contains(WRAP_CLASS) ? existing : null;
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = WRAP_CLASS;
      wrap.innerHTML =
        '<div class="ag-ascii-diagram-bar">' +
        `<span class="ag-ascii-diagram-badge">${badgeLabel}</span>` +
        '<button type="button" class="ag-ascii-diagram-toggle" title="切换原始文本">原文</button>' +
        '</div>' +
        '<pre class="ag-ascii-diagram"></pre>';
      const btn = wrap.querySelector('.ag-ascii-diagram-toggle');
      btn.addEventListener('click', () => {
        const showingRaw = !el.classList.contains(HIDDEN_CLASS);
        if (showingRaw) {
          el.classList.add(HIDDEN_CLASS);
          wrap.querySelector('.ag-ascii-diagram').style.display = '';
          btn.textContent = '原文';
        } else {
          el.classList.remove(HIDDEN_CLASS);
          wrap.querySelector('.ag-ascii-diagram').style.display = 'none';
          btn.textContent = '美化';
        }
      });
      el.insertAdjacentElement('afterend', wrap);
    } else {
      const badge = wrap.querySelector('.ag-ascii-diagram-badge');
      if (badge) badge.textContent = badgeLabel;
    }

    const diagPre = wrap.querySelector('.ag-ascii-diagram');
    diagPre.innerHTML = html;
    // Use exact integer/half-integer cell sizes for 0.6em/1.2em Maple Mono (12.5px -> 7.5px/15px, 10px -> 6px/12px) to prevent subpixel CJK drift
    diagPre.style.setProperty('font-size', maxCols > 118 ? '10px' : '12.5px', 'important');
    if (diagPre.style.display !== 'none') {
      el.classList.add(HIDDEN_CLASS);
    }
    el.setAttribute(ATTR_SIG, sig);
    return true;
  }

  function collectCandidates() {
    const set = new Set();
    document.querySelectorAll('pre').forEach((el) => {
      if (!isExcludedElement(el)) set.add(el);
    });
    document.querySelectorAll('.code-line').forEach((lineEl) => {
      const parent = lineEl.parentElement;
      if (parent && !isExcludedElement(parent) && !parent.closest('pre')) {
        set.add(parent);
      }
    });
    document.querySelectorAll('.cm-content').forEach((el) => {
      if (!isExcludedElement(el)) set.add(el);
    });
    const arr = Array.from(set);
    return arr.filter((el) => !arr.some((other) => other !== el && el.contains(other)));
  }

  function scanAll() {
    const candidates = collectCandidates();
    let matched = 0;
    for (const el of candidates) {
      if (enhanceTarget(el)) matched++;
    }
    window.__ag_ascii_diag_debug = {
      scanned: candidates.length,
      matched,
      lastRun: Date.now()
    };
  }

  if (typeof document !== 'undefined') {
    let timer = null;
    const scheduleScan = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          scanAll();
        } catch {}
      }, 220);
    };

    scheduleScan();
    const obs = new MutationObserver(scheduleScan);
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    const poll = setInterval(() => {
      try {
        scanAll();
      } catch {}
    }, 2000);

    if (typeof ctx !== 'undefined' && ctx && typeof ctx.onCleanup === 'function') {
      ctx.onCleanup(() => {
        if (timer) clearTimeout(timer);
        clearInterval(poll);
        try {
          obs.disconnect();
        } catch {}
        document.querySelectorAll('.' + WRAP_CLASS).forEach((el) => el.remove());
        document.querySelectorAll('.' + HIDDEN_CLASS).forEach((el) => {
          el.classList.remove(HIDDEN_CLASS);
          el.removeAttribute(ATTR_SIG);
        });
      });
    }
  }

  if (typeof globalThis !== 'undefined' && typeof document === 'undefined') {
    globalThis.__TEST_UNICODE__ = normalizeUnicodeDiagram;
  }
})();
