#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx"}
AUDIT_INSERT = re.compile(
    r"supabase\s*\.\s*from\(\s*[\"']audit_logs[\"']\s*\)\s*\.\s*insert\s*\(",
    re.S,
)
AUDIT_MUTATION = re.compile(
    r"supabase\s*\.\s*from\(\s*[\"']audit_logs[\"']\s*\)\s*\.\s*(insert|upsert|update|delete)\s*\(",
    re.S | re.I,
)


def scan_balanced(text: str, start: int) -> int:
    stack = ["("]
    i = start
    quote = None
    escaped = False
    pairs = {"(": ")", "[": "]", "{": "}"}
    while i < len(text):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('"', "'", "`"):
            quote = ch
            i += 1
            continue
        if ch in "([{":
            stack.append(ch)
        elif ch in ")]}" and stack and pairs[stack[-1]] == ch:
            stack.pop()
            if not stack:
                return i
        i += 1
    raise ValueError("Unbalanced audit insert call")


def split_top_level(body: str):
    parts = []
    start = 0
    stack = []
    quote = None
    escaped = False
    for i, ch in enumerate(body):
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            continue
        if ch in ('"', "'", "`"):
            quote = ch
            continue
        if ch in "([{":
            stack.append(ch)
        elif ch in ")]}" and stack:
            stack.pop()
        elif ch == "," and not stack:
            parts.append(body[start:i].strip())
            start = i + 1
    tail = body[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def parse_object(obj: str):
    obj = obj.strip()
    if not (obj.startswith("{") and obj.endswith("}")):
        raise ValueError(f"Expected object literal, got: {obj[:100]}")
    result = {}
    for prop in split_top_level(obj[1:-1]):
        stack = []
        quote = None
        escaped = False
        colon = None
        for i, ch in enumerate(prop):
            if quote:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == quote:
                    quote = None
                continue
            if ch in ('"', "'", "`"):
                quote = ch
                continue
            if ch in "([{":
                stack.append(ch)
            elif ch in ")]}" and stack:
                stack.pop()
            elif ch == ":" and not stack:
                colon = i
                break
        if colon is None:
            key = value = prop.strip()
        else:
            key = prop[:colon].strip()
            value = prop[colon + 1 :].strip()
        result[key.strip("\"'")] = value
    return result


def rpc_expression(values, indent: str) -> str:
    required = ("entity_type", "entity_id", "action", "details")
    missing = [key for key in required if key not in values]
    if missing:
        raise ValueError(f"Audit insert missing required fields {missing}: {values}")
    return (
        'supabase.rpc("qualisphere_add_audit_log", {\n'
        f'{indent}  p_entity_type: {values["entity_type"]},\n'
        f'{indent}  p_entity_id: {values["entity_id"]},\n'
        f'{indent}  p_action: {values["action"]},\n'
        f'{indent}  p_details: {values["details"]},\n'
        f'{indent}}})'
    )


def transform(text: str):
    position = 0
    output = []
    call_count = 0
    event_count = 0
    while True:
        match = AUDIT_INSERT.search(text, position)
        if not match:
            output.append(text[position:])
            break
        output.append(text[position : match.start()])
        end = scan_balanced(text, match.end())
        argument = text[match.end() : end].strip()
        line_start = text.rfind("\n", 0, match.start()) + 1
        prefix = text[line_start : match.start()]
        indent = re.match(r"\s*", prefix).group(0)

        if argument.startswith("{"):
            replacement = rpc_expression(parse_object(argument), indent)
            event_count += 1
        elif argument.startswith("["):
            objects = [
                parse_object(item)
                for item in split_top_level(argument[1:-1])
                if item.strip()
            ]
            inner_indent = indent + "  "
            rpc_calls = [
                inner_indent + rpc_expression(values, inner_indent)
                for values in objects
            ]
            replacement = "Promise.all([\n" + ",\n".join(rpc_calls) + "\n" + indent + "])"
            event_count += len(objects)
        else:
            raise ValueError(
                "Unsupported audit insert argument. Expected object or array literal: "
                + argument[:120]
            )

        output.append(replacement)
        position = end + 1
        call_count += 1

    return "".join(output), call_count, event_count


def source_files():
    for top in (ROOT / "app", ROOT / "components", ROOT / "lib", ROOT / "services"):
        if not top.exists():
            continue
        for path in top.rglob("*"):
            if path.is_file() and path.suffix in SOURCE_SUFFIXES:
                yield path


def main():
    changed = []
    calls = 0
    events = 0
    for path in source_files():
        original = path.read_text(encoding="utf-8")
        migrated, file_calls, file_events = transform(original)
        if file_calls:
            path.write_text(migrated, encoding="utf-8")
            rel = path.relative_to(ROOT).as_posix()
            changed.append((rel, file_calls, file_events))
            calls += file_calls
            events += file_events

    remaining = []
    for path in source_files():
        text = path.read_text(encoding="utf-8")
        matches = list(AUDIT_MUTATION.finditer(text))
        if matches:
            for match in matches:
                remaining.append(
                    f"{path.relative_to(ROOT).as_posix()}:{text.count(chr(10), 0, match.start()) + 1}:{match.group(1)}"
                )

    print(f"Migrated direct audit mutation calls: {calls}")
    print(f"Governed audit events represented: {events}")
    print(f"Files changed: {len(changed)}")
    for rel, file_calls, file_events in changed:
        print(f"  {rel}: {file_calls} call(s), {file_events} event(s)")

    if remaining:
        print("ERROR: direct audit_logs mutations remain:", file=sys.stderr)
        for item in remaining:
            print(f"  {item}", file=sys.stderr)
        return 1

    if calls == 0:
        print("No direct audit_logs inserts required migration.")
    print("Verification passed: zero direct application audit_logs mutations remain.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
