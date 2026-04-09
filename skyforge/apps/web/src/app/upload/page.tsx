"use client";

import { useState, useCallback } from "react";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(jpe?g|tiff?|dng)$/i.test(f.name)
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Upload Drone Photos</h1>
      <p className="mt-2 text-zinc-400">
        Drag and drop your drone imagery (JPEG, TIFF, DNG). Up to 2000 photos per project.
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        className={`mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          dragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-zinc-700 bg-zinc-900"
        }`}
      >
        <svg
          className="h-12 w-12 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
          />
        </svg>
        <p className="mt-4 text-zinc-400">
          Drag & drop drone photos here
        </p>
        <label className="mt-3 cursor-pointer rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
          Browse Files
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.tif,.tiff,.dng"
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {files.length} photo{files.length !== 1 ? "s" : ""} selected
              ({(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(0)} MB)
            </p>
            <button
              onClick={() => setFiles([])}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Clear all
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <select className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 border border-zinc-700">
              <option value="standard">Standard Quality (~1hr)</option>
              <option value="fast">Fast (~15min)</option>
              <option value="high">High Quality (~3hrs)</option>
            </select>
            <button className="flex-1 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
              Start Processing
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
