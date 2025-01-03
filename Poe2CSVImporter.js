// Global variables to store and manage data and charts
let rawData = [];
let filteredData = [];

// Track current sorting state
let currentSortColumn = null;
let currentSortAsc = true;

let timelineChart, barChart, pieChart, heatmapChart;

window.addEventListener('load', () => {
  const uploadBtn = document.getElementById('uploadBtn');
  const csvFileInput = document.getElementById('csvFileInput');

  uploadBtn.addEventListener('click', () => {
    const file = csvFileInput.files[0];
    if (file) {
      handleFile(file);
    } else {
      alert('Please select a CSV file first.');
    }
  });

  // Filter dropdowns
  const leagueFilter = document.getElementById('leagueFilter');
  const accountFilter = document.getElementById('accountFilter');
  const actionFilter = document.getElementById('actionFilter');

  // Attach event listeners to filters
  leagueFilter.addEventListener('change', applyFilters);
  accountFilter.addEventListener('change', applyFilters);
  actionFilter.addEventListener('change', applyFilters);

  // Export buttons
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  downloadCsvBtn.addEventListener('click', downloadCSV);

  const downloadPngBtn = document.getElementById('downloadPngBtn');
  downloadPngBtn.addEventListener('click', downloadPNG);

  // Attach click events to table headers for sorting
  attachTableHeaderListeners();
});

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const parsed = parseCSV(text);
    if (parsed) {
      rawData = parsed;
      populatePreviewTable(rawData);
      populateFilterOptions(rawData);
      updateAllCharts(rawData);
    }
  };
  reader.readAsText(file);
}

// Simple CSV parser (Assumes comma separated)
function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/);
  lines[0] = lines[0].replace(/^\uFEFF/, '');

  const header = lines[0].split(',').map(col => col.trim());

  // Ensure required columns exist
  const requiredColumns = ['Date', 'Id', 'League', 'Account', 'Action', 'Stash', 'Item'];
  for (const col of requiredColumns) {
    if (!header.includes(col)) {
      alert(`Missing required column: ${col}`);
      return null;
    }
  }

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length !== header.length) {
      console.warn(`Skipping malformed row: ${lines[i]}`);
      continue;
    }
    // Construct object, stripping quotes from every field
    const rowObj = {};
    for (let j = 0; j < header.length; j++) {
      // Remove leading/trailing quotes from each field
      const cleanedValue = row[j].replace(/^"|"$/g, '');
      rowObj[header[j]] = cleanedValue;
    }
    data.push(rowObj);
  }
  return data;
}

// Helper for formatting date
function formatDate(isoString) {
  const cleanedString = isoString.replace(/^"|"$/g, '');
  const dateObj = new Date(cleanedString);
  if (isNaN(dateObj)) {
    return isoString;
  }
  let month = dateObj.getMonth() + 1;
  let day = dateObj.getDate();
  let year = dateObj.getFullYear();
  let hours = dateObj.getHours();
  let minutes = dateObj.getMinutes();
  const amPm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  const yearStr = year.toString().slice(-2);
  const hoursStr = hours.toString();
  const minutesStr = minutes.toString().padStart(2, '0');

  return `${monthStr}/${dayStr}/${yearStr} ${hoursStr}:${minutesStr} ${amPm}`;
}

function populatePreviewTable(data) {
  if (currentSortColumn) {
    data = sortDataByColumn(data, currentSortColumn, currentSortAsc);
  }

  const tableBody = document.querySelector('#previewTable tbody');
  tableBody.innerHTML = '';

  data.forEach(row => {
    const formattedDate = formatDate(row.Date);
    const tr = document.createElement('tr');
    // Remove the Id and League columns from the table
    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td>${row.Account}</td>
      <td>${row.Action}</td>
      <td>${row.Stash}</td>
      <td>${row.Item}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function populateFilterOptions(data) {
  // Remove existing options except 'All'
  const leagueFilter = document.getElementById('leagueFilter');
  const accountFilter = document.getElementById('accountFilter');
  const actionFilter = document.getElementById('actionFilter');

  clearSelectOptions(leagueFilter);
  clearSelectOptions(accountFilter);
  clearSelectOptions(actionFilter);

  // Gather unique values for each field
  const leagues = [...new Set(data.map(d => d.League))];
  const accounts = [...new Set(data.map(d => d.Account))];
  const actions = [...new Set(data.map(d => d.Action))];

  // Populate each filter
  leagues.forEach(league => {
    const opt = document.createElement('option');
    opt.value = league;
    opt.textContent = league;
    leagueFilter.appendChild(opt);
  });

  accounts.forEach(account => {
    const opt = document.createElement('option');
    opt.value = account;
    opt.textContent = account;
    accountFilter.appendChild(opt);
  });

  actions.forEach(action => {
    const opt = document.createElement('option');
    opt.value = action;
    opt.textContent = action;
    actionFilter.appendChild(opt);
  });
}

function clearSelectOptions(selectElement) {
  while (selectElement.options.length > 1) {
    selectElement.remove(1); // Remove everything except index 0
  }
}

function applyFilters() {
  const leagueVal = document.getElementById('leagueFilter').value;
  const accountVal = document.getElementById('accountFilter').value;
  const actionVal = document.getElementById('actionFilter').value;

  filteredData = rawData.filter(item => {
    return (
      (leagueVal === '' || item.League === leagueVal) &&
      (accountVal === '' || item.Account === accountVal) &&
      (actionVal === '' || item.Action === actionVal)
    );
  });

  populatePreviewTable(filteredData);
  updateAllCharts(filteredData);
}

function updateAllCharts(data) {
  // Destroy existing charts if they exist
  if (timelineChart) timelineChart.destroy();
  if (barChart) barChart.destroy();
  if (pieChart) pieChart.destroy();
  if (heatmapChart) heatmapChart.destroy();

  // Create new charts
  createTimelineChart(data);
  createBarChart(data);
  createPieChart(data);
  createHeatmapChart(data);
}

function createTimelineChart(data) {
  const ctx = document.getElementById('timelineChart').getContext('2d');
  
  // Prepare data: group by date and league
  // For demonstration, we'll create a stacked bar over time by league
  const grouped = {};
  data.forEach(d => {
    const dateKey = d.Date;
    if(!grouped[dateKey]) {
      grouped[dateKey] = {};
    }
    if(!grouped[dateKey][d.League]) {
      grouped[dateKey][d.League] = 0;
    }
    grouped[dateKey][d.League]++;
  });

  const labels = Object.keys(grouped).sort();
  const leagueSet = [...new Set(data.map(d => d.League))];

  const datasets = leagueSet.map(league => {
    return {
      label: league,
      data: labels.map(date => grouped[date][league] || 0),
      backgroundColor: randomColor(),
      stack: 'TimelineStack'
    };
  });

  timelineChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label || ''}: ${context.parsed.y}`;
            }
          }
        }
      }
    }
  });
}

function createBarChart(data) {
  const ctx = document.getElementById('barChart').getContext('2d');
  
  // Frequency of action types
  const actionCount = {};
  data.forEach(d => {
    const action = d.Action;
    actionCount[action] = (actionCount[action] || 0) + 1;
  });

  const labels = Object.keys(actionCount);
  const values = Object.values(actionCount);

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Action Frequency',
          data: values,
          backgroundColor: labels.map(() => randomColor())
        }
      ]
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.x}`;
            }
          }
        }
      }
    }
  });
}

function createPieChart(data) {
  const ctx = document.getElementById('pieChart').getContext('2d');

  // Distribution by account
  const accountCount = {};
  data.forEach(d => {
    const account = d.Account;
    accountCount[account] = (accountCount[account] || 0) + 1;
  });

  const labels = Object.keys(accountCount);
  const values = Object.values(accountCount);

  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          label: 'Account Distribution',
          data: values,
          backgroundColor: labels.map(() => randomColor())
        }
      ]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              return `${label}: ${value}`;
            }
          }
        }
      }
    }
  });
}

function createHeatmapChart(data) {
  const ctx = document.getElementById('heatmapChart').getContext('2d');

  // For simplicity, create a placeholder heatmap style chart
  // We'll group activity by date for "rows" and hour for "columns" (assuming `Date` is date-time)
  // This is an approximation using bar chart stacked by hour

  // Extract date and hour from the Date field
  const dailyActivity = {};
  data.forEach(d => {
    // If the Date includes time, extract hour; otherwise default to 0
    let datePart = d.Date.split(' ')[0]; 
    let timePart = (d.Date.split(' ')[1] || '00:00').split(':')[0];
    let hour = parseInt(timePart, 10) || 0;

    if(!dailyActivity[datePart]) {
      dailyActivity[datePart] = Array(24).fill(0);
    }
    dailyActivity[datePart][hour]++;
  });

  const dates = Object.keys(dailyActivity).sort();
  const datasets = [];
  for (let h = 0; h < 24; h++) {
    datasets.push({
      label: `Hour ${h}`,
      data: dates.map(date => dailyActivity[date][h] || 0),
      backgroundColor: randomColor(),
      stack: 'HeatmapStack'
    });
  }

  heatmapChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets
    },
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Hour ${context.datasetIndex}: ${context.parsed.y}`;
            }
          }
        }
      }
    }
  });
}

function randomColor() {
  const r = Math.floor(Math.random() * 200);
  const g = Math.floor(Math.random() * 200);
  const b = Math.floor(Math.random() * 200);
  return `rgba(${r}, ${g}, ${b}, 0.6)`;
}

// Download filtered or raw data as CSV
function downloadCSV() {
  const dataToExport = filteredData && filteredData.length ? filteredData : rawData;
  if (!dataToExport.length) {
    alert('No data to export.');
    return;
  }
  
  const header = Object.keys(dataToExport[0]);
  const csvRows = [header.join(',')];
  
  for (const row of dataToExport) {
    const values = header.map(key => row[key]);
    csvRows.push(values.join(','));
  }
  
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'exported_data.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Download PNG of currently visible chart (just an example flow, uses timelineChart)
function downloadPNG() {
  if (!timelineChart) {
    alert('No chart available to download.');
    return;
  }
  const link = document.createElement('a');
  link.download = 'chart.png';
  link.href = timelineChart.toBase64Image('image/png', 1);
  link.click();
}

// Listen for clicks on each table header
function attachTableHeaderListeners() {
  const headers = document.querySelectorAll('#previewTable thead th');
  // Only the columns that are displayed:
  const columns = ['Date', 'Account', 'Action', 'Stash', 'Item'];
  headers.forEach((th, idx) => {
    th.addEventListener('click', () => {
      const column = columns[idx];
      if (currentSortColumn === column) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortColumn = column;
        currentSortAsc = true;
      }
      populatePreviewTable(filteredData.length ? filteredData : rawData);
    });
  });
}

// Generic sort helper
function sortDataByColumn(data, column, asc) {
  return [...data].sort((a, b) => {
    if (a[column] < b[column]) return asc ? -1 : 1;
    if (a[column] > b[column]) return asc ? 1 : -1;
    return 0;
  });
}
