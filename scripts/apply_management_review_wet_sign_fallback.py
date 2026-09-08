from pathlib import Path

# History page: allow wet-signature availability from snapshot or persisted report config.
page = Path('app/management-review/page.tsx')
text = page.read_text()
old = '''                      {review?.report_snapshot_json?.print_signing?.enabled === true &&
                      Array.isArray(review?.report_snapshot_json?.print_signing?.signers) &&
                      review.report_snapshot_json.print_signing.signers.length > 0 ? ('''
new = '''                      {hasWetSignatureConfiguration(review) ? ('''
if old not in text:
    raise SystemExit('history wet signature condition not found')
text = text.replace(old, new, 1)

marker = '''function ReportBuilder({\n'''
helper = '''function hasWetSignatureConfiguration(review: any) {\n  const snapshotConfig = review?.report_snapshot_json?.print_signing;\n  const savedConfig = review?.report_config_json?.print_signing;\n\n  const snapshotHasSigners =\n    snapshotConfig?.enabled === true &&\n    Array.isArray(snapshotConfig?.signers) &&\n    snapshotConfig.signers.length > 0;\n\n  const savedHasSigners =\n    savedConfig?.enabled === true &&\n    Array.isArray(savedConfig?.signers) &&\n    savedConfig.signers.length > 0;\n\n  return snapshotHasSigners || savedHasSigners;\n}\n\n'''
if marker not in text:
    raise SystemExit('ReportBuilder marker not found')
text = text.replace(marker, helper + marker, 1)
page.write_text(text)

# Print page: resolve wet signers from snapshot first, then persisted report config.
print_page = Path('app/management-review/print/page.tsx')
text = print_page.read_text()
old = '''        if (requestedMode === "wet") {\n          const printSigning = data.report_snapshot_json?.print_signing || {};\n          const wetSigners = Array.isArray(printSigning?.signers) ? printSigning.signers : [];\n          if (printSigning?.enabled !== true || wetSigners.length === 0) {\n            throw new Error("This Management Review snapshot was not configured with Print & Sign signers.");\n          }\n        }'''
new = '''        if (requestedMode === "wet") {\n          const printSigning = resolvePrintSigning(data);\n          const wetSigners = Array.isArray(printSigning?.signers) ? printSigning.signers : [];\n          if (printSigning?.enabled !== true || wetSigners.length === 0) {\n            throw new Error("This Management Review was not configured with Print & Sign signers.");\n          }\n        }'''
if old not in text:
    raise SystemExit('wet mode validation block not found')
text = text.replace(old, new, 1)

old = '''  const wetSignatureMode = reportMode === "wet";\n\n  return ('''
new = '''  const wetSignatureMode = reportMode === "wet";\n  const resolvedPrintSigning = resolvePrintSigning(review);\n  const reportSnapshot = wetSignatureMode\n    ? { ...snapshot, print_signing: resolvedPrintSigning }\n    : snapshot;\n\n  return ('''
if old not in text:
    raise SystemExit('wetSignatureMode marker not found')
text = text.replace(old, new, 1)

text = text.replace('''        snapshot={snapshot}\n''', '''        snapshot={reportSnapshot}\n''', 1)

marker = '''function formatPeriod(start?: string | null, end?: string | null) {\n'''
helper = '''function resolvePrintSigning(review: any) {\n  const snapshotConfig = review?.report_snapshot_json?.print_signing;\n  const savedConfig = review?.report_config_json?.print_signing;\n\n  if (\n    snapshotConfig?.enabled === true &&\n    Array.isArray(snapshotConfig?.signers) &&\n    snapshotConfig.signers.length > 0\n  ) {\n    return snapshotConfig;\n  }\n\n  if (\n    savedConfig?.enabled === true &&\n    Array.isArray(savedConfig?.signers) &&\n    savedConfig.signers.length > 0\n  ) {\n    return savedConfig;\n  }\n\n  return snapshotConfig || savedConfig || {};\n}\n\n'''
if marker not in text:
    raise SystemExit('formatPeriod marker not found')
text = text.replace(marker, helper + marker, 1)
print_page.write_text(text)
