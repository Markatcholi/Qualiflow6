from pathlib import Path

p = Path('app/management-review/page.tsx')
s = p.read_text()

# Add persistence helper before addPrintSigner.
marker = '  const addPrintSigner = () => {\n'
helper = '''  const persistPrintSigningDraft = async (enabled: boolean, signers: PrintSigner[]) => {
    if (!selectedReviewId || selectedReviewLocked || selectedReviewPendingApproval) return;

    const currentConfig =
      selectedReview?.report_config_json && typeof selectedReview.report_config_json === "object"
        ? selectedReview.report_config_json
        : {};

    const { error } = await supabase
      .from("management_reviews")
      .update({
        report_config_json: {
          ...currentConfig,
          print_signing: {
            enabled,
            signers: enabled ? signers : [],
          },
        },
      })
      .eq("id", selectedReviewId);

    if (error) {
      console.warn("Unable to persist Management Review Print & Sign draft configuration:", error.message);
      return;
    }

    setManagementReviews((current) =>
      current.map((review) =>
        review.id === selectedReviewId
          ? {
              ...review,
              report_config_json: {
                ...(review.report_config_json || {}),
                print_signing: {
                  enabled,
                  signers: enabled ? signers : [],
                },
              },
            }
          : review,
      ),
    );
  };

'''
if 'const persistPrintSigningDraft' not in s:
    if marker not in s:
        raise SystemExit('addPrintSigner marker not found')
    s = s.replace(marker, helper + marker, 1)

# Replace addPrintSigner body tail to persist the next signer list.
old_add = '''    setPrintSigners((current) => [
      ...current,
      {
        name: printSignerName.trim(),
        role: printSignerRole.trim(),
        signature_meaning: printSignerMeaning.trim(),
      },
    ]);
    setPrintSignerName("");
    setPrintSignerRole("");
'''
new_add = '''    const nextSigners = [
      ...printSigners,
      {
        name: printSignerName.trim(),
        role: printSignerRole.trim(),
        signature_meaning: printSignerMeaning.trim(),
      },
    ];
    setPrintSigners(nextSigners);
    void persistPrintSigningDraft(true, nextSigners);
    setPrintSignerName("");
    setPrintSignerRole("");
'''
if old_add in s:
    s = s.replace(old_add, new_add, 1)
elif 'void persistPrintSigningDraft(true, nextSigners);' not in s:
    raise SystemExit('add signer state block not found')

old_remove = '''  const removePrintSigner = (index: number) => {
    setPrintSigners((current) => current.filter((_, signerIndex) => signerIndex !== index));
  };
'''
new_remove = '''  const removePrintSigner = (index: number) => {
    const nextSigners = printSigners.filter((_, signerIndex) => signerIndex !== index);
    setPrintSigners(nextSigners);
    void persistPrintSigningDraft(printAndSignEnabled, nextSigners);
  };
'''
if old_remove in s:
    s = s.replace(old_remove, new_remove, 1)
elif 'void persistPrintSigningDraft(printAndSignEnabled, nextSigners);' not in s:
    raise SystemExit('remove signer block not found')

# Persist checkbox changes.
old_toggle = '            onChange={(event) => setPrintAndSignEnabled(event.target.checked)}\n'
new_toggle = '''            onChange={(event) => {
              const enabled = event.target.checked;
              setPrintAndSignEnabled(enabled);
              void persistPrintSigningDraft(enabled, printSigners);
            }}
'''
if old_toggle in s:
    s = s.replace(old_toggle, new_toggle, 1)
elif 'void persistPrintSigningDraft(enabled, printSigners);' not in s:
    raise SystemExit('print sign checkbox marker not found')

# Reload draft config whenever selected record changes or refreshed list returns.
period_effect = '''  useEffect(() => {
    if (reviewPeriodStart && reviewPeriodEnd) {
      fetchData();
    }
  }, [reviewPeriodStart, reviewPeriodEnd]);
'''
load_effect = '''
  useEffect(() => {
    if (!selectedReviewId) {
      setPrintAndSignEnabled(false);
      setPrintSigners([]);
      return;
    }

    const review = managementReviews.find((item) => item.id === selectedReviewId);
    if (!review) return;

    const draftPrintSigning = review?.report_config_json?.print_signing;
    const snapshotPrintSigning = review?.report_snapshot_json?.print_signing;
    const savedPrintSigning = draftPrintSigning || snapshotPrintSigning || {};
    const savedSigners = Array.isArray(savedPrintSigning?.signers) ? savedPrintSigning.signers : [];

    setPrintAndSignEnabled(savedPrintSigning?.enabled === true);
    setPrintSigners(
      savedSigners.map((signer: any) => ({
        name: String(signer?.name || ""),
        role: String(signer?.role || ""),
        signature_meaning: String(
          signer?.signature_meaning ||
            "I acknowledge that I reviewed this Management Review report and sign the printed controlled copy.",
        ),
      })),
    );
  }, [selectedReviewId, managementReviews]);
'''
if 'const draftPrintSigning = review?.report_config_json?.print_signing;' not in s:
    if period_effect not in s:
        raise SystemExit('review period effect marker not found')
    s = s.replace(period_effect, period_effect + load_effect, 1)

p.write_text(s)
