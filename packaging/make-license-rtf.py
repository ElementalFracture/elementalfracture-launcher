#!/usr/bin/env python3
"""Render legal/terms-of-service.md into the RTF the installer's Terms of
Service dialog scrolls through.

Windows Installer's ScrollableText control speaks RTF 1.x and nothing else, so
this walks the Markdown and emits headings, bold/italic runs, bullets and rules
directly. It is deliberately a small subset: the terms file only uses headings,
paragraphs, bullet lists, bold, italics, inline code, links and horizontal
rules.

  usage: make-license-rtf.py <terms.md> <out.rtf>
"""
import re
import sys

# RTF colour table indices, in the order they are written below.
GOLD, INK, GREY = 1, 2, 3


def esc(text):
    """Escape a run of plain text for RTF."""
    out = []
    for ch in text:
        if ch in "\\{}":
            out.append("\\" + ch)
        elif ord(ch) < 128:
            out.append(ch)
        else:
            # \uN needs a signed 16-bit code unit plus a 7-bit fallback char.
            code = ord(ch)
            for unit in ([code] if code < 0x10000 else
                         [0xD800 + ((code - 0x10000) >> 10),
                          0xDC00 + ((code - 0x10000) & 0x3FF)]):
                out.append("\\u%d?" % (unit - 65536 if unit > 32767 else unit))
    return "".join(out)


def inline(text):
    """Convert the inline Markdown span syntax we actually use."""
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)      # links -> label
    parts, pos = [], 0
    pattern = re.compile(r"\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`")
    for m in pattern.finditer(text):
        parts.append(esc(text[pos:m.start()]))
        if m.group(1) is not None:
            parts.append("{\\b %s}" % esc(m.group(1)))
        elif m.group(2) is not None:
            parts.append("{\\i %s}" % esc(m.group(2)))
        else:
            parts.append("{\\f1 %s}" % esc(m.group(3)))
        pos = m.end()
    parts.append(esc(text[pos:]))
    return "".join(parts)


def convert(md):
    # Drop the YAML front matter the docs site uses.
    if md.startswith("---"):
        md = md.split("---", 2)[-1]

    # RichEdit resets the character size at every \pard, so BODY has to be
    # repeated on each paragraph rather than set once in the header.
    BODY = r"\fs18"
    body = []
    seen_heading = False
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if re.fullmatch(r"-{3,}", line.strip()):
            body.append(r"{\pard\brdrb\brdrs\brdrw10\brdrcf%d\sa120%s\par}"
                        % (GREY, BODY))
            continue

        heading = re.match(r"(#{1,6})\s+(.*)", line)
        if heading:
            level = len(heading.group(1))
            # The dialog's own title already says "Terms of Service"; don't
            # repeat the document's H1 underneath it.
            if level == 1 and not seen_heading:
                seen_heading = True
                continue
            seen_heading = True
            size, colour = {1: (28, GOLD), 2: (24, GOLD), 3: (20, INK)}.get(
                level, (18, INK))
            body.append(r"\pard\sa60\sb160\keepn\cf%d\b\fs%d %s\b0\cf2\par"
                        % (colour, size, inline(heading.group(2))))
            continue

        bullet = re.match(r"\s*[-*]\s+(.*)", line)
        if bullet:
            body.append(r"\pard\fi-200\li400\sa60%s{\f2\'B7\tab}%s\par"
                        % (BODY, inline(bullet.group(1))))
            continue

        body.append(r"\pard\sa100%s %s\par" % (BODY, inline(line)))

    header = (
        r"{\rtf1\ansi\ansicpg1252\deff0\deflang1033"
        r"{\fonttbl"
        r"{\f0\fswiss\fcharset0 Segoe UI;}"
        r"{\f1\fmodern\fcharset0 Consolas;}"
        r"{\f2\fnil\fcharset2 Symbol;}}"
        r"{\colortbl ;\red150\green115\blue30;\red26\green26\blue26;"
        r"\red160\green160\blue160;}"
        r"\viewkind4\uc1\f0\fs18\cf2 "
    )
    return header + "\n".join(body) + "}\n"


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: make-license-rtf.py <terms.md> <out.rtf>")
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fh:
        rtf = convert(fh.read())
    # RTF is 7-bit; convert() has already escaped everything above ASCII.
    with open(dst, "w", encoding="ascii") as fh:
        fh.write(rtf)
    print("wrote %s (%d bytes)" % (dst, len(rtf)))


if __name__ == "__main__":
    main()
