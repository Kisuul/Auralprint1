from __future__ import annotations

import sys
from pathlib import Path

CSS_MARKER = "<!-- AURALPRINT_INLINE_CSS -->"
JS_MARKER = "<!-- AURALPRINT_INLINE_JS -->"
VERSION_MARKER = "__AURALPRINT_VERSION__"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def normalize_block(text: str) -> str:
    return text.rstrip("\n") + "\n"


def inline_style(css: str) -> str:
    return "<style>\n" + normalize_block(css) + "</style>"


def inline_script(js: str) -> str:
    safe_js = normalize_block(js).replace("</script", "<\\/script")
    return "<script>\n" + safe_js + "</script>"


def main(argv: list[str]) -> int:
    if len(argv) != 6:
        print(
            "Usage: python scripts/assemble_single_file.py "
            "<template.html> <bundle.css> <bundle.js> <version-tag> <output.html>",
            file=sys.stderr,
        )
        return 1

    template_path = Path(argv[1])
    css_path = Path(argv[2])
    js_path = Path(argv[3])
    version_tag = argv[4].strip()
    output_path = Path(argv[5])

    template = read_text(template_path)
    css = read_text(css_path)
    js = read_text(js_path)

    if CSS_MARKER not in template:
        raise SystemExit(f"Missing CSS marker in template: {template_path}")
    if JS_MARKER not in template:
        raise SystemExit(f"Missing JS marker in template: {template_path}")
    if VERSION_MARKER not in template:
        raise SystemExit(f"Missing version marker in template: {template_path}")
    if not version_tag:
        raise SystemExit("Version tag must be a non-empty string.")

    assembled = template.replace(VERSION_MARKER, version_tag, 1)
    assembled = assembled.replace(CSS_MARKER, inline_style(css), 1)
    assembled = assembled.replace(JS_MARKER, inline_script(js), 1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(assembled, encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
