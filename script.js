const csvFile = "./export.csv";
let eventsData = [];

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map(value => value.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every(cell => cell === "")) continue;

    const row = {};
    header.forEach((column, index) => {
      row[column] = cells[index] || "";
    });

    rows.push(row);
  }

  return rows;
}

function formatIsoDate(dateString) {
  const normalized = dateString.toString().trim();
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  return normalized;
}

function formatDisplayDate(dateString) {
  const isoDate = formatIsoDate(dateString);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate.split("-").reverse().join(".");
  }
  return isoDate;
}

function normalizeRow(row) {
  const rawOrt = row.Ort || "";
  const rawPlz = row.PLZ || "";
  let ort = rawOrt.trim();
  let plz = rawPlz.trim();

  if (/^\d+$/.test(ort) && /\D/.test(plz)) {
    ort = rawPlz.trim();
    plz = rawOrt.trim();
  }

  const street = (row.Strasse || "").trim();
  const houseNumber = (row.Hausnummer || "").trim();
  const addressParts = [];
  if (street) addressParts.push(`${street}${houseNumber ? ` ${houseNumber}` : ""}`);
  if (plz) addressParts.push(plz);
  if (ort) addressParts.push(ort);

  return {
    titel: row["Überschrift"] || row["Intern. Bezeichnung"] || "Event",
    forstamt: row["Intern. Bezeichnung"] || "",
    ort: ort,
    adresse: addressParts.join(", "),
    datum_von: formatIsoDate(row.DatumStart || ""),
    datum_bis: formatIsoDate(row.DatumEnde || ""),
    uhrzeit: `${(row.UhrzeitStart || "").trim()}${row.UhrzeitEnde ? ` – ${(row.UhrzeitEnde || "").trim()}` : ""}`.trim(),
    typ: row["Überschrift"] || "",
    description: (row.Teasertext || "").trim(),
  };
}

function buildFilters() {
  const regions = [...new Set(eventsData.map(e => e.ort).filter(Boolean))].sort();
  const types = [...new Set(eventsData.map(e => e.typ).filter(Boolean))].sort();

  const regionSelect = document.getElementById("regionFilter");
  regions.forEach(r => {
    const option = document.createElement("option");
    option.value = r;
    option.textContent = r;
    regionSelect.appendChild(option);
  });

  const typeSelect = document.getElementById("typeFilter");
  types.forEach(t => {
    const option = document.createElement("option");
    option.value = t;
    option.textContent = t;
    typeSelect.appendChild(option);
  });
}

function isTodayOpen(dv, db) {
  const today = new Date();
  const from = new Date(dv);
  const to = db ? new Date(db) : from;
  return today >= from && today <= to;
}

function render(data) {
  const container = document.getElementById("events");
  container.innerHTML = "";

  if (!data.length) {
    container.innerHTML = "<p>Keine Events gefunden.</p>";
    return;
  }

  data.forEach(e => {
    const dateFrom = formatDisplayDate(e.datum_von);
    const dateTo = e.datum_bis && e.datum_bis !== e.datum_von ? formatDisplayDate(e.datum_bis) : "";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${e.titel} ${isTodayOpen(e.datum_von, e.datum_bis) ? '<span class="badge">Heute geöffnet</span>' : ''}</h3>
      <p><strong>Forstamt:</strong> ${e.forstamt || "–"}</p>
      <p><strong>Ort:</strong> ${e.ort || "–"}</p>
      <p><strong>Adresse:</strong> ${e.adresse || "–"}</p>
      <p><strong>Datum:</strong> ${dateFrom}${dateTo ? ' – ' + dateTo : ''}</p>
      <p><strong>Uhrzeit:</strong> ${e.uhrzeit || "–"}</p>
      ${e.description ? `<p class="description">${e.description}</p>` : ""}
    `;
    container.appendChild(card);
  });
}

function filter() {
  const search = document.getElementById("search").value.toLowerCase();
  const region = document.getElementById("regionFilter").value;
  const type = document.getElementById("typeFilter").value;

  const filtered = eventsData.filter(e => {
    const matchSearch = [e.titel, e.forstamt, e.ort, e.adresse, e.typ]
      .join(" ")
      .toLowerCase()
      .includes(search);
    const matchRegion = region ? e.ort === region : true;
    const matchType = type ? e.typ === type : true;
    return matchSearch && matchRegion && matchType;
  });

  render(filtered);
}

function showError(message) {
  const container = document.getElementById("events");
  container.innerHTML = `<p>${message}</p>`;
}

function loadEvents() {
  fetch(csvFile)
    .then(response => {
      if (!response.ok) {
        throw new Error(`CSV-Datei konnte nicht geladen werden: ${response.statusText}`);
      }
      return response.text();
    })
    .then(text => {
      const rows = parseCsv(text);
      eventsData = rows.map(normalizeRow).sort((a, b) => new Date(a.datum_von) - new Date(b.datum_von));
      buildFilters();
      render(eventsData);
    })
    .catch(error => {
      console.error(error);
      showError("Fehler beim Laden der Event-Daten. Prüfe, ob export.csv vorhanden ist und öffne die Seite über einen lokalen HTTP-Server (nicht per file://).");
    });
}

document.getElementById("search").addEventListener("input", filter);
document.getElementById("regionFilter").addEventListener("change", filter);
document.getElementById("typeFilter").addEventListener("change", filter);

loadEvents();
