// ⚒️ Signature Help — Shows function parameter info while typing

interface SignatureHelpProps {
  visible: boolean;
  x: number;
  y: number;
  signatures: SignatureInfo[];
  activeSignature: number;
  activeParameter: number;
}

interface SignatureInfo {
  label: string;
  documentation?: string;
  parameters: { label: string; documentation?: string }[];
}

export function SignatureHelp({
  visible, x, y, signatures, activeSignature, activeParameter
}: SignatureHelpProps) {
  if (!visible || signatures.length === 0) return null;

  const sig = signatures[activeSignature] || signatures[0];

  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y - 60,
      maxWidth: 500,
      background: "#1e1e2e",
      border: "1px solid #45475a",
      borderRadius: 6,
      padding: "6px 12px",
      fontSize: 12,
      color: "#cdd6f4",
      fontFamily: "var(--font-code)",
      zIndex: 400,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      pointerEvents: "none",
    }}>
      {/* Function signature with highlighted parameter */}
      <div style={{ whiteSpace: "pre-wrap" }}>
        {renderSignatureWithHighlight(sig.label, sig.parameters, activeParameter)}
      </div>

      {/* Parameter documentation */}
      {sig.parameters[activeParameter]?.documentation && (
        <div style={{
          marginTop: 4,
          paddingTop: 4,
          borderTop: "1px solid #313244",
          color: "#a6adc8",
          fontSize: 11,
        }}>
          {sig.parameters[activeParameter].documentation}
        </div>
      )}

      {/* Signature counter */}
      {signatures.length > 1 && (
        <div style={{ color: "#585b70", fontSize: 10, marginTop: 2 }}>
          {activeSignature + 1}/{signatures.length}
        </div>
      )}
    </div>
  );
}

function renderSignatureWithHighlight(
  label: string,
  params: { label: string }[],
  activeIdx: number
): React.ReactNode {
  if (!params.length || activeIdx < 0) {
    return <span>{label}</span>;
  }

  const activeParam = params[activeIdx];
  if (!activeParam) return <span>{label}</span>;

  const paramStart = label.indexOf(activeParam.label);
  if (paramStart === -1) return <span>{label}</span>;

  const before = label.slice(0, paramStart);
  const highlighted = label.slice(paramStart, paramStart + activeParam.label.length);
  const after = label.slice(paramStart + activeParam.label.length);

  return (
    <span>
      {before}
      <span style={{ color: "#f9e2af", fontWeight: 600, textDecoration: "underline" }}>
        {highlighted}
      </span>
      {after}
    </span>
  );
}
