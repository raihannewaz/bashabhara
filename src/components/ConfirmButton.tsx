"use client";

export default function ConfirmButton({ children, message }: { children: React.ReactNode; message: string }) {
  return (
    <button type="submit" className="btn-danger" onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
