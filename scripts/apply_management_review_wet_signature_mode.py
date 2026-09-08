from pathlib import Path

# --- Print page: split electronic and wet-signature presentation modes ---
p = Path('app/management-review/print/page.tsx')
s = p.read_text()

s = s.replace(
'''  const [errorMessage, setErrorMessage] = useState("");\n  const [review, setReview] = useState<any>(null);\n''',
'''  const [errorMessage, setErrorMessage] = useState("");\n  const [review, setReview] = useState<any>(null);\n  const [reportMode, setReportMode] = useState<"electronic" | "wet">("electronic");\n''',
1,
)

s = s.replace(
'''        const params = new URLSearchParams(window.location.search);\n        const reviewId = params.get("review_id") || params.get("reviewId") || "";\n''',
'''        const params = new URLSearchParams(window.location.search);\n        const reviewId = params.get("review_id") || params.get("reviewId") || "";\n        const requestedMode = params.get("mode") === "wet" ? "wet" : "electronic";\n''',
1,
)

old_validation = '''        if (!data.report_snapshot_json) {\n          throw new Error("This Management Review does not contain a generated report snapshot.");\n        }\n\n        setReview(data);\n'''
new_validation = '''        if (!data.report_snapshot_json) {\n          throw new Error("This Management Review does not contain a generated report snapshot.");\n        }\n\n        if (requestedMode === "wet") {\n          const printSigning = data.report_snapshot_json?.print_signing || {};\n          const wetSigners = Array.isArray(printSigning?.signers) ? printSigning.signers : [];\n          if (printSigning?.enabled !== true || wetSigners.length === 0) {\n            throw new Error("This Management Review snapshot was not configured with Print & Sign signers.");\n          }\n        }\n\n        setReportMode(requestedMode);\n        setReview(data);\n'''
if old_validation not in s:
    raise SystemExit('print validation block not found')
s = s.replace(old_validation, new_validation, 1)

s = s.replace(
'''  const period = formatPeriod(review.review_period_start, review.review_period_end);\n\n  return (\n''',
'''  const period = formatPeriod(review.review_period_start, review.review_period_end);\n  const wetSignatureMode = reportMode === "wet";\n\n  return (\n''',
1,
)

s = s.replace(
'''        <button type="button" onClick={() => window.print()} style={buttonStyle}>\n          Print / Save as PDF\n        </button>\n''',
'''        <button type="button" onClick={() => window.print()} style={buttonStyle}>\n          {wetSignatureMode ? "Print Wet-Signature Report / Save as PDF" : "Print / Save as PDF"}\n        </button>\n''',
1,
)

old_header_right = '''        <div style={{ textAlign: "right" }}>\n          <div><strong>Prepared By:</strong> {review.prepared_by || "N/A"}</div>\n          <div><strong>Snapshot Generated:</strong> {formatDateTime(snapshot.generated_at)}</div>\n          <div><strong>Approval Status:</strong> {review.approval_status || review.status || "draft"}</div>\n          <div><strong>Locked:</strong> {review.is_locked ? "Yes" : "No"}</div>\n          {review.locked_at ? <div><strong>Locked At:</strong> {formatDateTime(review.locked_at)}</div> : null}\n        </div>\n'''
new_header_right = '''        <div style={{ textAlign: "right" }}>\n          <div><strong>Prepared By:</strong> {review.prepared_by || "N/A"}</div>\n          <div><strong>Snapshot Generated:</strong> {formatDateTime(snapshot.generated_at)}</div>\n          {wetSignatureMode ? (\n            <div><strong>Report Type:</strong> Wet Signature Copy</div>\n          ) : (\n            <>\n              <div><strong>Approval Status:</strong> {review.approval_status || review.status || "draft"}</div>\n              <div><strong>Locked:</strong> {review.is_locked ? "Yes" : "No"}</div>\n              {review.locked_at ? <div><strong>Locked At:</strong> {formatDateTime(review.locked_at)}</div> : null}\n            </>\n          )}\n        </div>\n'''
if old_header_right not in s:
    raise SystemExit('print header block not found')
s = s.replace(old_header_right, new_header_right, 1)

old_notice = '''      <section style={noticeStyle}>\n        <strong>Controlled report source:</strong> This report is rendered from the saved Management Review report snapshot. It does not recalculate live QMS data when opened or printed.\n      </section>\n'''
new_notice = '''      <section style={noticeStyle}>\n        {wetSignatureMode ? (\n          <>\n            <strong>Wet-signature report:</strong> This copy is rendered from the saved Management Review report snapshot and is intended only for configured physical signatures. Wet signatures do not close or lock the Management Review record; electronic approval in QualiSphere remains required.\n          </>\n        ) : (\n          <>\n            <strong>Controlled report source:</strong> This report is rendered from the saved Management Review report snapshot. It does not recalculate live QMS data when opened or printed.\n          </>\n        )}\n      </section>\n'''
if old_notice not in s:
    raise SystemExit('print notice block not found')
s = s.replace(old_notice, new_notice, 1)

s = s.replace(
'''        executiveSummary={review.executive_summary}\n        showPrintSignatureBlocks\n      />\n''',
'''        executiveSummary={review.executive_summary}\n        showPrintSignatureBlocks={wetSignatureMode}\n      />\n''',
1,
)

old_approval_start = '''      <section style={cardStyle}>\n        <h2 style={sectionTitleStyle}>Approval Record</h2>\n'''
if old_approval_start not in s:
    raise SystemExit('approval section start not found')
s = s.replace(old_approval_start, '''      {!wetSignatureMode ? (\n      <section style={cardStyle}>\n        <h2 style={sectionTitleStyle}>Approval Record</h2>\n''', 1)

old_approval_end = '''      </section>\n\n      <footer style={footerStyle}>\n        QualiSphere Enterprise QMS | Management Review | {period} | {review.review_number || "N/A"}\n      </footer>\n'''
new_approval_end = '''      </section>\n      ) : null}\n\n      <footer style={footerStyle}>\n        QualiSphere Enterprise QMS | Management Review | {period} | {review.review_number || "N/A"}{wetSignatureMode ? " | Wet Signature Copy" : ""}\n      </footer>\n'''
if old_approval_end not in s:
    raise SystemExit('approval section end not found')
s = s.replace(old_approval_end, new_approval_end, 1)

p.write_text(s)

# --- Management Review history: expose wet-signature report only when configured in snapshot ---
p = Path('app/management-review/page.tsx')
s = p.read_text()

old_report_cell = '''                  <td style={tdStyle}>\n                    <button\n                      type="button"\n                      onClick={() =>\n                        window.open(`/management-review/print?review_id=${review.id}`, "_blank")\n                      }\n                    >\n                      Open Report\n                    </button>\n                  </td>\n'''
new_report_cell = '''                  <td style={tdStyle}>\n                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>\n                      <button\n                        type="button"\n                        onClick={() =>\n                          window.open(`/management-review/print?review_id=${review.id}`, "_blank")\n                        }\n                      >\n                        Open Electronic Report\n                      </button>\n                      {review?.report_snapshot_json?.print_signing?.enabled === true &&\n                      Array.isArray(review?.report_snapshot_json?.print_signing?.signers) &&\n                      review.report_snapshot_json.print_signing.signers.length > 0 ? (\n                        <button\n                          type="button"\n                          onClick={() =>\n                            window.open(`/management-review/print?review_id=${review.id}&mode=wet`, "_blank")\n                          }\n                        >\n                          Open Wet Signature Report\n                        </button>\n                      ) : null}\n                    </div>\n                  </td>\n'''
if old_report_cell not in s:
    raise SystemExit('history report cell not found')
s = s.replace(old_report_cell, new_report_cell, 1)

p.write_text(s)
