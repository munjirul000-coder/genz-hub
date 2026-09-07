'use strict';

// Export helpers. CSV is produced directly; "Excel" uses the SpreadsheetML 2003
// XML format (the file opens in Excel / Google Sheets / LibreOffice as a real
// .xls workbook) without any binary library dependency.

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => csvEscape(row[c.key] == null ? '' : row[c.key])).join(',')
  );
  return [header, ...lines].join('\r\n');
}

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build a SpreadsheetML .xls file (single worksheet). Excel-compatible.
function toSpreadsheetML(rows, columns, sheetName = 'Submissions') {
  const headerRow =
    '<Row>' + columns.map((c) => `<Cell><Data ss:Type="String">${xmlEscape(c.label)}</Data></Cell>`).join('') + '</Row>';
  const bodyRows = rows
    .map(
      (row) =>
        '<Row>' +
        columns
          .map(
            (c) =>
              `<Cell><Data ss:Type="String">${xmlEscape(row[c.key] == null ? '' : row[c.key])}</Data></Cell>`
          )
          .join('') +
        '</Row>'
    )
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(sheetName)}">
  <Table>
   ${headerRow}
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

const SUBMISSION_COLUMNS = [
  { key: 'id', label: 'Anonymous ID' },
  { key: 'createdAt', label: 'Date/Time (UTC)' },
  { key: 'category', label: 'Category' },
  { key: 'problem', label: 'Problem' },
  { key: 'desiredSolution', label: 'Desired Solution' },
  { key: 'broadLocation', label: 'Broad Location' },
];

const OPPORTUNITY_COLUMNS = [
  { key: 'id', label: 'Cluster ID' },
  { key: 'title', label: 'Opportunity' },
  { key: 'score', label: 'Opportunity Score (0-100)' },
  { key: 'scoreLabel', label: 'Signal Label' },
  { key: 'submissionCount', label: 'Related Submissions' },
  { key: 'categories', label: 'Categories' },
  { key: 'locations', label: 'Locations' },
  { key: 'keywords', label: 'Keywords' },
];

module.exports = { toCsv, toSpreadsheetML, SUBMISSION_COLUMNS, OPPORTUNITY_COLUMNS };
