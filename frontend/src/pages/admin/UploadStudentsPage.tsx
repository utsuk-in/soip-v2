import React, { useState } from "react";
import { Upload, Download, CheckCircle, AlertTriangle, FileSpreadsheet, UserPlus, Copy, Check, ExternalLink } from "lucide-react";
import { validateStudentUpload, confirmStudentUpload, downloadTemplate, type StudentRow, type UploadValidationResponse, type UploadSummary, type MagicLinkResult } from "../../lib/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={handleCopy} title="Copy" className="shrink-0 p-1 text-stone-400 hover:text-brand-600 transition-colors">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

function MagicLinkRow({ result }: { result: MagicLinkResult }) {
  return (
    <tr className="border-t border-stone-100 dark:border-stone-800">
      <td className="px-3 py-2 text-stone-700 dark:text-stone-300 text-xs">{result.email}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 max-w-[180px]">
          <code className="text-xs text-stone-600 dark:text-stone-300 font-mono truncate flex-1">{result.magic_token}</code>
          <CopyButton text={result.magic_token} />
        </div>
      </td>
      <td className="px-3 py-2">
        <a
          href={result.magic_link_url}
          target="_blank"
          rel="noreferrer"
          title="Open onboarding link"
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
        >
          <ExternalLink size={12} />
          Open
        </a>
      </td>
    </tr>
  );
}

function QuickAddForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicResult, setMagicResult] = useState<MagicLinkResult | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMagicResult(null);

    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim() || !email.includes("@")) { setError("A valid email is required"); return; }

    const row: StudentRow = {
      row_number: 1,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      roll_number: rollNumber.trim() || null,
      department: department.trim() || null,
      year_of_study: yearOfStudy.trim() || null,
    };

    setLoading(true);
    try {
      const result = await confirmStudentUpload([row]);
      if (result.duplicate_skipped > 0) {
        setError(`${email.trim().toLowerCase()} is already registered.`);
      } else if (result.failed > 0) {
        setError("Failed to invite student. Please try again.");
      } else {
        setMagicResult(result.invited_students[0] ?? null);
        setName(""); setEmail(""); setRollNumber(""); setDepartment(""); setYearOfStudy("");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus size={18} className="text-brand-500" />
        <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200">Quick Add — Single Student</h2>
      </div>

      {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

      {magicResult && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400">Student invited — magic link ready</p>
          <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5">
            <code className="flex-1 text-xs text-stone-600 dark:text-stone-300 font-mono truncate">{magicResult.magic_token}</code>
            <CopyButton text={magicResult.magic_token} />
          </div>
          <a
            href={magicResult.magic_link_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800"
          >
            <ExternalLink size={12} />
            Open onboarding link
          </a>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text" placeholder="Full Name *" value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
          />
          <input
            type="email" placeholder="Email *" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
          />
          <input
            type="text" placeholder="Roll Number" value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
          />
          <input
            type="text" placeholder="Department" value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
          />
          <input
            type="text" placeholder="Year of Study" value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500 sm:col-span-2"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Inviting..." : "Invite Student"}
        </button>
      </form>
    </div>
  );
}

type BulkStep = "upload" | "review" | "done";

export default function UploadStudentsPage() {
  const [step, setStep] = useState<BulkStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<UploadValidationResponse | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleValidate = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const result = await validateStudentUpload(file);
      setValidation(result);
      setStep("review");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!validation) return;
    setLoading(true);
    setError("");
    try {
      const result = await confirmStudentUpload(validation.valid_rows);
      setSummary(result);
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async (format: "xlsx" | "csv") => {
    try {
      await downloadTemplate(format);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setValidation(null);
    setSummary(null);
    setError("");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Student Registration</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Add students individually or in bulk</p>
      </div>

      <QuickAddForm />

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 border-t border-stone-200 dark:border-stone-700" />
        <span className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest">Bulk Upload</span>
        <div className="flex-1 border-t border-stone-200 dark:border-stone-700" />
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleDownloadTemplate("xlsx")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
        >
          <Download size={16} />
          Template (.xlsx)
        </button>
        <button
          type="button"
          onClick={() => handleDownloadTemplate("csv")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          <Download size={16} />
          Template (.csv)
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-8">
          <div className="border-2 border-dashed border-stone-300 dark:border-stone-600 rounded-xl p-10 text-center">
            <FileSpreadsheet size={48} className="mx-auto text-stone-300 dark:text-stone-600 mb-4" />
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              Drop your .xlsx or .csv file here, or click to browse
            </p>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-brand-700 transition-colors"
            >
              <Upload size={16} />
              Choose File
            </label>
            {file && (
              <p className="mt-3 text-sm text-stone-600 font-medium">{file.name}</p>
            )}
          </div>

          {file && (
            <button
              type="button"
              onClick={handleValidate}
              disabled={loading}
              className="mt-4 w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Validating..." : "Validate & Preview"}
            </button>
          )}
        </div>
      )}

      {/* Step 2: Review */}
      {step === "review" && validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 text-center">
              <p className="text-2xl font-bold text-brand-600">{validation.valid_rows.length}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Valid Rows</p>
            </div>
            <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{validation.errors.length}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Errors</p>
            </div>
            <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 text-center">
              <p className="text-2xl font-bold text-stone-400">{validation.duplicates.length}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Duplicates</p>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Errors (will be skipped)</p>
              </div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {validation.errors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                    Row {err.row_number}: {err.field} — {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {validation.duplicates.length > 0 && (
            <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl p-4">
              <p className="text-sm font-semibold text-stone-600 dark:text-stone-300 mb-1">Duplicate emails (will be skipped)</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{validation.duplicates.join(", ")}</p>
            </div>
          )}

          {validation.valid_rows.length > 0 && (
            <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 dark:bg-stone-800 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Name</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Email</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Dept</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.valid_rows.map((row) => (
                      <tr key={row.row_number} className="border-t border-stone-100 dark:border-stone-800">
                        <td className="px-4 py-2 text-stone-800 dark:text-stone-100">{row.name}</td>
                        <td className="px-4 py-2 text-stone-500 dark:text-stone-400">{row.email}</td>
                        <td className="px-4 py-2 text-stone-500 dark:text-stone-400">{row.department || "—"}</td>
                        <td className="px-4 py-2 text-stone-500 dark:text-stone-400">{row.year_of_study || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={reset} className="flex-1 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800">
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || validation.valid_rows.length === 0}
              className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Uploading..." : `Invite ${validation.valid_rows.length} Students`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && summary && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-8">
          <div className="text-center mb-6">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2">Upload Complete</h2>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-2xl font-bold text-green-600">{summary.invited}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Invited</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{summary.duplicate_skipped}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Skipped (duplicates)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{summary.failed}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Failed</p>
              </div>
            </div>
          </div>

          {summary.invited_students.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">Magic Links Issued</p>
              <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 dark:bg-stone-800 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Token</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.invited_students.map((r) => (
                        <MagicLinkRow key={r.student_id} result={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={reset} className="w-full px-6 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700">
            Upload Another
          </button>
        </div>
      )}
    </div>
  );
}
