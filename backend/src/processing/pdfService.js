const PDFDocument = require('pdfkit');

function streamTextAsPdf(text, res) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(14).text('Transcripcion', { underline: true });
  doc.moveDown();
  doc.fontSize(11).text(text || '(sin contenido)', { align: 'left' });
  doc.end();
}

module.exports = { streamTextAsPdf };
