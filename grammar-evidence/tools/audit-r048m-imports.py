"""Read-only inventory of static relative imports from the R048M Edge entrypoint.

An absent path is a source difference, not a recommendation to copy that module.
"""

from __future__ import annotations

import json
import posixpath
import re
import subprocess
from collections import deque

ROOT = posixpath.dirname(posixpath.dirname(posixpath.dirname(__file__.replace("\\", "/"))))
SOURCE_REV = "7d964a3"
TARGET_REV = "HEAD"
ENTRY = "supabase/functions/canonical-graph-shadow-v1/index.ts"
IMPORT = re.compile(r"(?:\bfrom\s*|\bimport\s*)['\"](\.[^'\"]+)['\"]")


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True, encoding="utf-8")


def content(rev: str, path: str) -> str | None:
    result = git("show", f"{rev}:{path}")
    return result.stdout if result.returncode == 0 else None


def paths(rev: str) -> set[str]:
    result = git("ls-tree", "-r", "--name-only", rev, "--", "supabase/functions")
    if result.returncode:
        raise SystemExit(result.stderr)
    return set(result.stdout.splitlines())


def resolved(importer: str, specifier: str) -> str:
    path = posixpath.normpath(posixpath.join(posixpath.dirname(importer), specifier))
    return path if posixpath.splitext(path)[1] else path + ".ts"


def main() -> None:
    source_paths = paths(SOURCE_REV)
    head_paths = paths(TARGET_REV)
    queue = deque([ENTRY])
    seen: set[str] = set()
    edges: list[dict[str, object]] = []
    while queue:
        importer = queue.popleft()
        if importer in seen:
            continue
        seen.add(importer)
        body = content(SOURCE_REV, importer)
        if body is None:
            raise SystemExit(f"Missing source module in {SOURCE_REV}: {importer}")
        for specifier in sorted(set(IMPORT.findall(body))):
            target = resolved(importer, specifier)
            if not target.startswith("supabase/functions/"):
                continue
            source_exists = target in source_paths
            target_exists = target in head_paths
            edges.append({
                "importer": importer,
                "specifier": specifier,
                "target": target,
                "depth": "direct" if importer == ENTRY else "transitive",
                "source_exists": source_exists,
                "head_exists": target_exists,
            })
            if source_exists and target not in seen:
                queue.append(target)
    missing = sorted({str(row["target"]) for row in edges if row["source_exists"] and not row["head_exists"]})
    direct_nlp = [row for row in edges if row["importer"] == ENTRY and str(row["target"]).startswith("supabase/functions/_shared/nlp/")]
    output = {
        "schema_version": "r048m-static-import-audit-v1",
        "source_revision": git("rev-parse", SOURCE_REV).stdout.strip(),
        "target_revision": git("rev-parse", TARGET_REV).stdout.strip(),
        "entrypoint": ENTRY,
        "scope": "static relative imports only; no runtime or equivalence conclusion",
        "direct_nlp_import_count": len(direct_nlp),
        "direct_nlp_absent_head_count": sum(not row["head_exists"] for row in direct_nlp),
        "reachable_source_module_count": len(seen),
        "absent_head_modules": missing,
        "edges": edges,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
