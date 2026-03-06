import React, { useState } from "react";
import { Upload, Download, CheckCircle, AlertTriangle, FileSpreadsheet, UserPlus } from "lucide-react";
import { validateStudentUpload, confirmStudentUpload, downloadTemplate, type StudentRow, type UploadValidationResponse, type UploadSummary } from "../../lib/api";

function QuickAddForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

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
        setSuccess(`${row.email} invited — magic link logged to console.`);
        setName(""); setEmail(""); setRollNumber(""); setDepartment(""); setYearOfStudy("");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus size={18} className="text-brand-500" />
        <h2 className="text-sm font-semibold text-stone-700">Quick Add — Single Student</h2>
      </div>

      {error && <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="mb-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text" placeholder="Full Name *" value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="email" placeholder="Email *" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text" placeholder="Roll Number" value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text" placeholder="Department" value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text" placeholder="Year of Study" value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:col-span-2"
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

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate();
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
        <h1 className="text-2xl font-bold text-stone-800">Student Registration</h1>
        <p className="text-sm text-stone-500 mt-1">Add students individually or in bulk</p>
      </div>

      <QuickAddForm />

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 border-t border-stone-200" />
        <span className="text-xs font-medium text-stone-400 uppercase tracking-widest">Bulk Upload</span>
        <div className="flex-1 border-t border-stone-200" />
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 border border-brand-200 rounded-xl hover:bg-brand-50 transition-colors"
        >
          <Download size={16} />
          Template
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-8">
          <div className="border-2 border-dashed border-stone-300 rounded-xl p-10 text-center">
            <FileSpreadsheet size={48} className="mx-auto text-stone-300 mb-4" />
            <p className="text-sm text-stone-500 mb-4">
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
            <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
              <p className="text-2xl font-bold text-brand-600">{validation.valid_rows.length}</p>
              <p className="text-xs text-stone-500">Valid Rows</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{validation.errors.length}</p>
              <p className="text-xs text-stone-500">Errors</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
              <p className="text-2xl font-bold text-stone-400">{validation.duplicates.length}</p>
              <p className="text-xs text-stone-500">Duplicates</p>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <p className="text-sm font-semibold text-amber-700">Errors (will be skipped)</p>
              </div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {validation.errors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-600">
                    Row {err.row_number}: {err.field} — {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {validation.duplicates.length > 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-stone-600 mb-1">Duplicate emails (will be skipped)</p>
              <p className="text-xs text-stone-500">{validation.duplicates.join(", ")}</p>
            </div>
          )}

          {validation.valid_rows.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Name</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Email</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Dept</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.valid_rows.map((row) => (
                      <tr key={row.row_number} className="border-t border-stone-100">
                        <td className="px-4 py-2 text-stone-800">{row.name}</td>
                        <td className="px-4 py-2 text-stone-500">{row.email}</td>
                        <td className="px-4 py-2 text-stone-500">{row.department || "—"}</td>
                        <td className="px-4 py-2 text-stone-500">{row.year_of_study || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-2.5 border border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50">
              Back
            </button>
            <button
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
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-stone-800 mb-2">Upload Complete</h2>
          <div className="grid grid-cols-3 gap-4 mt-6 mb-6">
            <div>
              <p className="text-2xl font-bold text-green-600">{summary.invited}</p>
              <p className="text-xs text-stone-500">Invited</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{summary.duplicate_skipped}</p>
              <p className="text-xs text-stone-500">Skipped (duplicates)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{summary.failed}</p>
              <p className="text-xs text-stone-500">Failed</p>
            </div>
          </div>
          <p className="text-sm text-stone-500 mb-6">Magic link invites have been logged to the console.</p>
          <button onClick={reset} className="px-6 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700">
            Upload Another
          </button>
        </div>
      )}
    </div>
  );
}
