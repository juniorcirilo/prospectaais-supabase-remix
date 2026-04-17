import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface CsvUploaderProps { onDataParsed: (headers: string[], rows: string[][]) => void; }

function detectDelimiter(firstLine: string): string {
  const delimiters = [';', ',', '\t', '|'];
  let best = ',', max = 0;
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length;
    if (count > max) { max = count; best = d; }
  }
  return best;
}

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };
  const d = detectDelimiter(lines[0]);
  const headers = lines[0].split(d).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map(l => l.split(d).map(c => c.trim().replace(/^["']|["']$/g, '')));
  return { headers, rows };
}

const CsvUploader: React.FC<CsvUploaderProps> = ({ onDataParsed }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    setError(null);
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) { setError('Use .csv ou .txt'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target?.result as string);
      if (!headers.length) { setError('Arquivo vazio'); return; }
      if (!rows.length) { setError('Sem dados'); return; }
      setFileName(file.name); setPreviewHeaders(headers); setPreviewRows(rows.slice(0, 5)); onDataParsed(headers, rows);
    };
    reader.readAsText(file, 'UTF-8');
  }, [onDataParsed]);

  return (
    <div className="space-y-4">
      {!fileName ? (
        <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
          <input type="file" accept=".csv,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Arraste seu arquivo CSV aqui</p>
          <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl border border-border">
          <FileText className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{fileName}</p><p className="text-xs text-muted-foreground">{previewHeaders.length} colunas</p></div>
          <button onClick={() => { setFileName(null); setPreviewHeaders([]); setPreviewRows([]); onDataParsed([], []); }} className="p-1.5 rounded-lg hover:bg-destructive/10"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      )}
      {error && <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"><AlertCircle className="w-4 h-4" />{error}</div>}
      {previewHeaders.length > 0 && previewRows.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-secondary/50 border-b border-border"><p className="text-xs font-medium text-muted-foreground uppercase">Preview</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{previewHeaders.map((h, i) => <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-foreground bg-secondary/30">{h}</th>)}</tr></thead>
              <tbody>{previewRows.map((row, i) => <tr key={i} className="border-b border-border/50 last:border-0">{row.map((cell, j) => <td key={j} className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{cell || <span className="italic opacity-50">vazio</span>}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CsvUploader;