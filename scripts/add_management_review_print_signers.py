from pathlib import Path

# Owner page
p = Path('app/management-review/page.tsx')
s = p.read_text()

supplier_type = '''type SupplierCount = {
  supplier: string;
  count: number;
};
'''
print_type = '''type PrintSigner = {
  name: string;
  role: string;
  signature_meaning: string;
};

'''
if 'type PrintSigner' not in s:
    if supplier_type not in s:
        raise SystemExit('SupplierCount type marker not found')
    s = s.replace(supplier_type, supplier_type + '\n' + print_type, 1)

state_marker = '  const [reportDataPeriodKey, setReportDataPeriodKey] = useState("");\n'
print_states = '''  const [printAndSignEnabled, setPrintAndSignEnabled] = useState(false);
  const [printSignerName, setPrintSignerName] = useState("");
  const [printSignerRole, setPrintSignerRole] = useState("");
  const [printSignerMeaning, setPrintSignerMeaning] = useState(
    "I acknowledge that I reviewed this Management Review report and sign the printed controlled copy.",
  );
  const [printSigners, setPrintSigners] = useState<PrintSigner[]>([]);
'''
if 'printAndSignEnabled' not in s:
    if state_marker not in s:
        raise SystemExit('Report period state marker not found')
    s = s.replace(state_marker, state_marker + print_states, 1)

snapshot_marker = '      report_config: reportConfig,\n'
snapshot_add = '''      print_signing: {
        enabled: printAndSignEnabled,
        signers: printAndSignEnabled ? printSigners : [],
      },
'''
if 'print_signing:' not in s:
    if snapshot_marker not in s:
        raise SystemExit('Snapshot report_config marker not found')
    s = s.replace(snapshot_marker, snapshot_marker + snapshot_add, 1)

add_approver_marker = '  const addApprover = async () => {'
print_funcs = '''  const addPrintSigner = () => {
    if (!printSignerName.trim()) {
      alert("Print signer name is required.");
      return;
    }

    if (!printSignerRole.trim()) {
      alert("Print signer role / title is required.");
      return;
    }

    if (!printSignerMeaning.trim()) {
      alert("Print signer signature meaning is required.");
      return;
    }

    setPrintSigners((current) => [
      ...current,
      {
        name: printSignerName.trim(),
        role: printSignerRole.trim(),
        signature_meaning: printSignerMeaning.trim(),
      },
    ]);
    setPrintSignerName("");
    setPrintSignerRole("");
  };

  const removePrintSigner = (index: number) => {
    setPrintSigners((current) => current.filter((_, signerIndex) => signerIndex !== index));
  };

'''
if 'const addPrintSigner' not in s:
    if add_approver_marker not in s:
        raise SystemExit('addApprover marker not found')
    s = s.replace(add_approver_marker, print_funcs + add_approver_marker, 1)

# Insert print/sign configuration immediately before Add Approver heading.
if 'Optional Print & Sign' not in s:
    heading_pos = s.find('Add Approver')
    if heading_pos == -1:
        raise SystemExit('Add Approver heading text not found')
    h2_pos = s.rfind('<h2', 0, heading_pos)
    if h2_pos == -1:
        raise SystemExit('Add Approver h2 marker not found')
    print_ui = '''      <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", padding: "18px", marginBottom: "22px", background: "#f8fafc" }}>
        <h3 style={{ marginTop: 0 }}>Optional Print & Sign</h3>
        <label style={{ display: "flex", gap: "10px", alignItems: "center", fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={printAndSignEnabled}
            onChange={(event) => setPrintAndSignEnabled(event.target.checked)}
            disabled={selectedReviewLocked || selectedReviewPendingApproval}
          />
          Include wet-signature blocks on the printable controlled report
        </label>
        <p style={{ color: "#475569", marginBottom: printAndSignEnabled ? "14px" : 0 }}>
          Print signers are separate from electronic Workspace approvers. They do not create approval tasks or change electronic approval status.
        </p>

        {printAndSignEnabled ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" }}>
              <label>
                Signer Name
                <input value={printSignerName} onChange={(event) => setPrintSignerName(event.target.value)} style={{ width: "100%" }} />
              </label>
              <label>
                Role / Title
                <input value={printSignerRole} onChange={(event) => setPrintSignerRole(event.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <label style={{ display: "block", marginBottom: "12px" }}>
              Signature Meaning
              <textarea
                value={printSignerMeaning}
                onChange={(event) => setPrintSignerMeaning(event.target.value)}
                rows={3}
                style={{ width: "100%" }}
              />
            </label>
            <button type="button" onClick={addPrintSigner}>Add Print Signer</button>

            {printSigners.length > 0 ? (
              <div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
                {printSigners.map((signer, index) => (
                  <div key={`${signer.name}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: "12px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", background: "white" }}>
                    <div>
                      <strong>{signer.name}</strong> — {signer.role}
                      <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>{signer.signature_meaning}</div>
                    </div>
                    <button type="button" onClick={() => removePrintSigner(index)}>Remove</button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

'''
    s = s[:h2_pos] + print_ui + s[h2_pos:]

p.write_text(s)

# Shared report renderer
p = Path('app/management-review/components/ManagementReviewSnapshotReport.tsx')
s = p.read_text()

if 'showPrintSignatureBlocks?: boolean;' not in s:
    s = s.replace(
        '  executiveSummary?: string | null;\n};',
        '  executiveSummary?: string | null;\n  showPrintSignatureBlocks?: boolean;\n};',
        1,
    )
    s = s.replace(
        '  executiveSummary,\n}: Props) {',
        '  executiveSummary,\n  showPrintSignatureBlocks = false,\n}: Props) {',
        1,
    )

if 'const printSigning = snapshot?.print_signing' not in s:
    s = s.replace(
        '  const trends = snapshot?.trends || {};\n',
        '  const trends = snapshot?.trends || {};\n  const printSigning = snapshot?.print_signing || {};\n  const printSigners = Array.isArray(printSigning?.signers) ? printSigning.signers : [];\n',
        1,
    )

trend_block = '''      {config.trendCharts ? (
        <ReportSection title="Trend Data">
          <TrendTable trends={trends} />
        </ReportSection>
      ) : null}
'''
print_block = '''
      {showPrintSignatureBlocks && printSigning?.enabled && printSigners.length > 0 ? (
        <ReportSection title="Print & Sign">
          <p style={helperTextStyle}>
            The following wet-signature blocks were configured when this report snapshot was generated. These signatures are separate from electronic Workspace approvals.
          </p>
          <PrintSignatureBlocks signers={printSigners} />
        </ReportSection>
      ) : null}
'''
if 'PrintSignatureBlocks signers={printSigners}' not in s:
    if trend_block not in s:
        raise SystemExit('Trend rendering block not found')
    s = s.replace(trend_block, trend_block + print_block, 1)

if 'function PrintSignatureBlocks' not in s:
    marker = 'function arrayCount(value: any) {'
    component = '''function PrintSignatureBlocks({ signers }: { signers: any[] }) {
  return (
    <div style={{ display: "grid", gap: "22px" }}>
      {signers.map((signer: any, index: number) => (
        <div key={`${signer?.name || "signer"}-${index}`} style={printSignatureBlockStyle}>
          <div><strong>Printed Name:</strong> {signer?.name || "N/A"}</div>
          <div><strong>Role / Title:</strong> {signer?.role || "N/A"}</div>
          <div style={{ marginTop: "8px" }}><strong>Signature Meaning:</strong> {signer?.signature_meaning || "I reviewed this Management Review report."}</div>
          <div style={signatureLineRowStyle}>
            <div style={signatureLineStyle}>Signature</div>
            <div style={dateLineStyle}>Date</div>
          </div>
        </div>
      ))}
    </div>
  );
}

'''
    if marker not in s:
        raise SystemExit('arrayCount marker not found')
    s = s.replace(marker, component + marker, 1)

if 'const printSignatureBlockStyle' not in s:
    style_marker = 'const sectionStyle: React.CSSProperties = {'
    styles = '''const printSignatureBlockStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: 18,
  breakInside: "avoid",
};
const signatureLineRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginTop: 36 };
const signatureLineStyle: React.CSSProperties = { borderTop: "1px solid #0f172a", paddingTop: 6, fontSize: 12, color: "#475569" };
const dateLineStyle: React.CSSProperties = { borderTop: "1px solid #0f172a", paddingTop: 6, fontSize: 12, color: "#475569" };

'''
    if style_marker not in s:
        raise SystemExit('section style marker not found')
    s = s.replace(style_marker, styles + style_marker, 1)

p.write_text(s)

# Printable page only: show wet-signature blocks.
p = Path('app/management-review/print/page.tsx')
s = p.read_text()
if 'showPrintSignatureBlocks' not in s:
    s = s.replace(
        '        executiveSummary={review.executive_summary}\n      />',
        '        executiveSummary={review.executive_summary}\n        showPrintSignatureBlocks\n      />',
        1,
    )
p.write_text(s)
