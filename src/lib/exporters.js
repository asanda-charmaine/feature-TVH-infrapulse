// CSV / Excel / PDF export. Excel and PDF libraries are loaded on demand to keep the app light.

const safeName = (name) => name.replace(/[^\w-]+/g, '_');
const stamp = () => new Date().toISOString().slice(0, 10);

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(headers, rows) {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/**
 * @param {'csv'|'xlsx'|'pdf'} format
 * @param {{name:string,title:string,headers:string[],rows:any[][]}} table
 */
export async function exportTable(format, { name, title, headers, rows }) {
  const file = `${safeName(name)}_${stamp()}`;
  if (format === 'csv') {
    download(new Blob(['﻿' + toCSV(headers, rows)], { type: 'text/csv;charset=utf-8' }), `${file}.csv`);
    return;
  }
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(40, Math.max(h.length, ...rows.slice(0, 200).map((r) => String(r[i] ?? '').length)) + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, safeName(name).slice(0, 30) || 'InfraPulse');
    XLSX.writeFile(wb, `${file}.xlsx`);
    return;
  }
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 181, 174);
    doc.rect(0, 0, w, 54, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('InfraPulse', 32, 32);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Improving infrastructure, improving lives', 32, 45);
    doc.setTextColor(11, 31, 58);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 32, 84);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated ${new Date().toLocaleString('en-GB')} · ${rows.length} row(s)`, 32, 98);
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) => r.map((c) => (c == null ? '' : String(c)))),
      startY: 110,
      styles: { fontSize: 8, cellPadding: 4, textColor: [11, 31, 58] },
      headStyles: { fillColor: [11, 31, 58], textColor: 255 },
      alternateRowStyles: { fillColor: [243, 251, 251] },
      margin: { left: 32, right: 32 },
    });
    doc.save(`${file}.pdf`);
  }
}
