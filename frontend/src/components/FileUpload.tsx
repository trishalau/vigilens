import { Upload, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

interface FileUploadProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  fileName?: string;
}

export function FileUpload({ onFile, disabled = false, fileName }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFile = (file?: File) => {
    if (file && !disabled) onFile(file);
  };

  return (
    <div
      className={`upload-zone${dragging ? " upload-zone--dragging" : ""}${disabled ? " upload-zone--disabled" : ""}`}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".csv,text/csv"
        disabled={disabled}
        onChange={(event) => { acceptFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}
        aria-label="Choose a transaction CSV file"
      />
      <span className="upload-zone__icon"><UploadCloud size={23} /></span>
      <div className="upload-zone__copy">
        <strong>{fileName || "Drop your transaction CSV here"}</strong>
        <span>or choose a file · up to 250 rows and 2 MB</span>
      </div>
      <button className="button button--secondary button--compact" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Upload size={15} /> Choose CSV
      </button>
    </div>
  );
}
