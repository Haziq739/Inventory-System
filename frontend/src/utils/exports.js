import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Helper to extract size
export const parseItem = (name) => {
  const sizeMatch = name.match(/\s+(\d+[A-Za-z]*|S|M|L|XL|XX|XXL)$/i);
  if (sizeMatch) {
    return { 
      cleanName: name.replace(sizeMatch[0], '').trim(), 
      size: sizeMatch[1].trim()
    };
  }
  return { cleanName: name, size: '-' };
};

/**
 * Generate PDF Invoice
 */
export const generatePDF = (invoice) => {
  try {
    const doc = new jsPDF();
    const margin = 20;

    // Header - Company Name
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text('JANNAT UNIFORMS', margin, 25);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Premium Garments & School Uniforms', margin, 32);

    // Invoice Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`INVOICE: ${invoice.invoice_number}`, 140, 25);
    doc.text(`DATE: ${invoice.date}`, 140, 32);

    // Client Info
    doc.setDrawColor(200);
    doc.line(margin, 40, 190, 40);
    doc.text('BILL TO:', margin, 50);
    doc.setFontSize(14);
    doc.text(invoice.client_name, margin, 58);

    // Table
    const tableData = invoice.items.map(item => {
      const { cleanName, size } = parseItem(item.item_name);
      return [
        cleanName,
        item.item_code,
        size,
        item.quantity.toString(),
        item.unit_price.toFixed(2),
        item.total.toFixed(2)
      ];
    });

    autoTable(doc, {
      startY: 70,
      head: [['Item Name', 'Item Code', 'Size', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      headStyles: { fillStyle: 'fill', fillColor: [59, 130, 246] },
      margin: { left: margin, right: margin }
    });

    // Grand Total
    const finalY = (doc).lastAutoTable.finalY + 10;
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(`GRAND TOTAL:  Rs. ${invoice.grand_total.toFixed(2)}`, margin + 100, finalY);

    // Direct browser download
    doc.save(`${invoice.invoice_number}.pdf`);
  } catch (err) {
    console.error('PDF Generation Error:', err);
    throw err;
  }
};

/**
 * Generate Excel Invoice
 */
export const generateExcel = (invoice) => {
  const data = [
    ['JANNAT UNIFORMS'],
    ['Invoice Number', invoice.invoice_number],
    ['Date', invoice.date],
    ['Client', invoice.client_name],
    [],
    ['Item Name', 'Item Code', 'Size', 'Quantity', 'Unit Price', 'Total']
  ];

  invoice.items.forEach(item => {
    const { cleanName, size } = parseItem(item.item_name);
    data.push([
      cleanName,
      item.item_code,
      size,
      item.quantity,
      item.unit_price,
      item.total
    ]);
  });

  data.push([], ['GRAND TOTAL', '', '', '', '', invoice.grand_total]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice');
  
  // Direct browser download
  XLSX.writeFile(workbook, `${invoice.invoice_number}.xlsx`);
};

/**
 * Generate PDF Receipt
 */
export const generateReceiptPDF = (payment) => {
  try {
    const doc = new jsPDF();
    const margin = 20;

    // Header - Company Name
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text('JANNAT UNIFORMS', margin, 25);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Premium Garments & School Uniforms', margin, 32);

    // Receipt Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`RECEIPT: ${payment.receipt_number}`, 140, 25);
    doc.text(`DATE: ${payment.date}`, 140, 32);

    // Client Info
    doc.setDrawColor(200);
    doc.line(margin, 40, 190, 40);
    doc.text('RECEIVED FROM:', margin, 50);
    doc.setFontSize(14);
    doc.text(payment.client_name, margin, 58);

    // Payment Details
    doc.setFontSize(12);
    doc.text('PAYMENT DETAILS', margin, 80);
    doc.line(margin, 82, 190, 82);
    
    doc.setFontSize(11);
    doc.text('Client Code:', margin, 95);
    doc.text(payment.client_code, margin + 40, 95);

    doc.text('Amount Received:', margin, 105);
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text(`Rs. ${payment.amount.toFixed(2)}`, margin + 40, 105);
    
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Notes / Remarks:', margin, 115);
    
    if (payment.notes) {
      const splitNotes = doc.splitTextToSize(payment.notes, 140);
      doc.text(splitNotes, margin + 40, 115);
    } else {
      doc.text('-', margin + 40, 115);
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Thank you for your business.', margin, 150);

    // Direct browser download
    doc.save(`${payment.receipt_number}.pdf`);
  } catch (err) {
    console.error('Receipt PDF Generation Error:', err);
    throw err;
  }
};
