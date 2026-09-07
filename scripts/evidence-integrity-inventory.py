#!/usr/bin/env python3
from pathlib import Path
import re
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = [ROOT / "app", ROOT / "components", ROOT / "lib", ROOT / "services"]
SUFFIXES = {".ts", ".tsx", ".js", ".jsx"}

MUTATION = re.compile(
    r"(?:supabase|\w*Supabase\w*)\s*\.\s*from\(\s*[\"']([^\"']+)[\"']\s*\)\s*\.\s*(insert|upsert|update|delete)\s*\(",
    re.I | re.S,
)
RPC = re.compile(r"\.rpc\(\s*[\"']([^\"']+)[\"']", re.I)

SENSITIVE_TERMS = (
    "audit", "history", "signature", "signatures", "snapshot", "approval", "approvals",
    "evidence", "verification", "review", "release", "revision", "training", "attestation",
    "closure", "certificate", "record_history"
)


def source_files():
    for top in SOURCE_ROOTS:
        if not top.exists():
            continue
        for path in top.rglob("*"):
            if path.is_file() and path.suffix in SUFFIXES:
                yield path


def main():
    by_table = defaultdict(list)
    rpc_calls = defaultdict(list)

    for path in source_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        rel = path.relative_to(ROOT).as_posix()
        for m in MUTATION.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            table, op = m.group(1), m.group(2).lower()
            by_table[table].append((op, rel, line))
        for m in RPC.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            rpc_calls[m.group(1)].append((rel, line))

    total = sum(len(v) for v in by_table.values())
    print(f"TOTAL_DIRECT_MUTATIONS={total}")
    print(f"UNIQUE_MUTATED_TABLES={len(by_table)}")
    print("\n=== ALL DIRECT TABLE MUTATIONS ===")
    for table in sorted(by_table):
        entries = by_table[table]
        ops = defaultdict(int)
        for op, _, _ in entries:
            ops[op] += 1
        print(f"TABLE {table} TOTAL {len(entries)} OPS " + ",".join(f"{k}:{v}" for k,v in sorted(ops.items())))
        for op, rel, line in entries:
            print(f"  {op.upper():6} {rel}:{line}")

    print("\n=== SENSITIVE / EVIDENCE-LIKE TABLE CANDIDATES ===")
    sensitive = []
    for table in sorted(by_table):
        low = table.lower()
        if any(term in low for term in SENSITIVE_TERMS):
            sensitive.append(table)
            print(f"TABLE {table}")
            for op, rel, line in by_table[table]:
                print(f"  {op.upper():6} {rel}:{line}")
    print(f"SENSITIVE_TABLE_COUNT={len(sensitive)}")

    print("\n=== GOVERNANCE / EVIDENCE-RELATED RPC CALLS ===")
    for rpc in sorted(rpc_calls):
        low = rpc.lower()
        if any(term in low for term in SENSITIVE_TERMS) or "ncmr" in low or "capa" in low:
            print(f"RPC {rpc} COUNT {len(rpc_calls[rpc])}")
            for rel, line in rpc_calls[rpc]:
                print(f"  {rel}:{line}")


if __name__ == "__main__":
    main()
