const h = React.createElement;
const { useEffect, useRef, useState } = React;

const TARGET_SCORE = 60;
const ALL_SHEETS = "__all_sheets__";
const ASSESSMENT_SHEETS = "__assessment_sheets__";
const COUNTRY_ORDER = ["China", "Finland", "Italy", "Singapore", "USA", "Czechia", "UAE", "Netherlands", "Germany", "Malaysia", "Austria", "Canada", "Belgium", "France", "Australia", "Bulgaria", "Slovakia"];
const YEAR_DATA_FILES = {
  2026: "ISO 27001 Maturity Assessments 2026.xlsx",
  2027: "ISO 27001 Maturity Assessments 2027.xlsx"
};
const DOMAIN_DEFINITIONS = [
  { key: "HR", label: "HR Security" },
  { key: "Legal", label: "Legal Security" },
  { key: "Supply Chain Security", label: "Supply Chain Security" },
  { key: "Physical Security", label: "Physical Security" }
];

const MATURITY_LEVELS = [
  { label: "No Data", score: 0, className: "score-na", color: "#94a3b8" },
  { label: "Initial", score: 20, className: "score-red", color: "#d92d20" },
  { label: "Defined", score: 40, className: "score-orange", color: "#ea8c19" },
  { label: "Standard", score: 60, className: "score-green", color: "#157347" },
  { label: "Advanced", score: 80, className: "score-green", color: "#2f16bd" }
];

const FIELD_MATCHERS = {
  country: /(country|market|nation|geography|region)/i,
  site: /(site|location|facility|office|plant|branch|warehouse)/i,
  domain: /(domain|pillar|function|area|category|department|stream|security area)/i,
  control: /(control|finding|observation|question|requirement|item|measure|activity|process)/i,
  maturity: /(maturity|level|rating|status|score|assessment)/i,
  risk: /(risk|severity|exposure|criticality|priority|impact)/i,
  automation: /(automated|automation|automation status|manual)/i
};

const COUNTRY_ALIASES = new Map([
  ["china", "China"],
  ["prc", "China"],
  ["people s republic of china", "China"],
  ["finland", "Finland"],
  ["italy", "Italy"],
  ["singapore", "Singapore"],
  ["usa", "USA"],
  ["us", "USA"],
  ["u s", "USA"],
  ["united states", "USA"],
  ["united states of america", "USA"],
  ["czechia", "Czechia"],
  ["czech republic", "Czechia"],
  ["uae", "UAE"],
  ["united arab emirates", "UAE"],
  ["netherlands", "Netherlands"],
  ["the netherlands", "Netherlands"],
  ["holland", "Netherlands"],
  ["germany", "Germany"],
  ["malaysia", "Malaysia"],
  ["austria", "Austria"],
  ["canada", "Canada"],
  ["belgium", "Belgium"],
  ["france", "France"],
  ["australia", "Australia"],
  ["bulgaria", "Bulgaria"],
  ["slovakia", "Slovakia"]
]);

function formatInt(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatScore(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(value % 1 === 0 ? 0 : 1);
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "").replace(/[^0-9.+-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasRowContent(row) {
  return Object.values(row).some((value) => String(value ?? "").trim() !== "");
}

function getColumns(rows) {
  return [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "__sheetName")))];
}

function average(values) {
  const filtered = values.filter((value) => value != null && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function groupBy(records, keyFn) {
  const groups = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

function getOrderedCountries(records) {
  const seen = new Set(records.map((record) => record.country).filter((country) => country && country !== "Unspecified Country"));
  const ordered = COUNTRY_ORDER.filter((country) => seen.has(country));
  for (const country of [...seen].sort((left, right) => left.localeCompare(right))) {
    if (!ordered.includes(country)) ordered.push(country);
  }
  return ordered.length > 0 ? ordered : COUNTRY_ORDER;
}

function getMaturityBand(score) {
  if (score == null || Number.isNaN(score) || score <= 0) return MATURITY_LEVELS[0];
  if (score < 30) return MATURITY_LEVELS[1];
  if (score < 50) return MATURITY_LEVELS[2];
  if (score < 70) return MATURITY_LEVELS[3];
  return MATURITY_LEVELS[4];
}

function parseMaturity(value) {
  const raw = normalizeText(value);
  if (!raw) return { label: "No Data", score: 0, applicable: false };

  const numeric = parseNumeric(raw);
  if (numeric != null) {
    const normalized = Number(numeric);
    const scoreByCode = {
      0: 0,
      1: 20,
      2: 40,
      3: 20,
      4: 40,
      5: 60,
      6: 80,
      20: 20,
      40: 40,
      60: 60,
      80: 80
    };

    let score = scoreByCode[normalized];
    if (score == null && normalized > 0) {
      const anchors = [20, 40, 60, 80];
      score = anchors.reduce((best, current) => Math.abs(current - normalized) < Math.abs(best - normalized) ? current : best, anchors[0]);
    }

    const band = getMaturityBand(score);
    return { label: band.label, score: band.score, applicable: band.score > 0 };
  }

  const text = normalizeKey(raw);
  if (/not applicable|n a|na|not assessed|no control/.test(text)) return { label: "No Data", score: 0, applicable: false };
  if (/initial|basic|ad hoc|reactive|immature/.test(text)) return { label: "Initial", score: 20, applicable: true };
  if (/defined|documented|repeatable|managed|developing/.test(text)) return { label: "Defined", score: 40, applicable: true };
  if (/standard|established|compliant|stable|target/.test(text)) return { label: "Standard", score: 60, applicable: true };
  if (/advanced|optimized|optimised|mature|proactive/.test(text)) return { label: "Advanced", score: 80, applicable: true };

  return { label: titleCase(raw), score: null, applicable: false };
}

function parseExplicitRisk(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  const numeric = parseNumeric(raw);
  if (numeric != null) {
    if (numeric <= 0) return null;
    if (numeric <= 5) return Math.round(numeric);
    if (numeric <= 20) return 1;
    if (numeric <= 40) return 2;
    if (numeric <= 60) return 3;
    if (numeric <= 80) return 4;
    return 5;
  }

  const text = normalizeKey(raw);
  if (/critical|very high|severe/.test(text)) return 5;
  if (/high/.test(text)) return 4;
  if (/medium|moderate/.test(text)) return 3;
  if (/low/.test(text)) return 2;
  if (/very low|minimal/.test(text)) return 1;
  return null;
}

function parseAutomationStatus(value) {
  const text = normalizeKey(value);
  if (!text) return false;
  return /^(yes|y|true|automated|automatic|partially automated|semi automated|partly automated)$/.test(text)
    || /automated|automatic/.test(text);
}

function getAutomationPotential(control) {
  const text = normalizeKey(control);
  const highKeywords = ["monitoring", "tracking", "logging", "encryption", "access control", "inventory", "training assignment"];
  const mediumKeywords = ["review", "assessment", "evaluation", "approval"];
  const lowKeywords = ["management responsibility", "awareness", "disciplinary process", "visitor escort"];
  if (highKeywords.some((keyword) => text.includes(keyword))) return "High";
  if (mediumKeywords.some((keyword) => text.includes(keyword))) return "Medium";
  if (lowKeywords.some((keyword) => text.includes(keyword))) return "Low";
  return "";
}

function deriveRiskFromMaturity(score) {
  if (score == null || score <= 0) return null;
  if (score >= 80) return 1;
  if (score >= 60) return 2;
  if (score >= 40) return 3;
  return 5;
}

function parseRisk(value, maturityScore) {
  // Keep risk consistent across all sheets by deriving only from maturity.
  return deriveRiskFromMaturity(maturityScore);
}

function canonicalizeDomain(value) {
  const raw = normalizeText(value);
  if (!raw) return "Other";
  const text = normalizeKey(raw);
  if (/human resources|\bhr\b|people/.test(text)) return "HR";
  if (/legal|compliance|contract|regulatory/.test(text)) return "Legal";
  if (/supplier|supply chain|vendor|third party|procurement|partner/.test(text)) return "Supply Chain Security";
  if (/physical|guard|perimeter|access control|cctv|facility security|security site/.test(text)) return "Physical Security";
  return "Other";
}

function canonicalizeCountry(value) {
  const raw = normalizeText(value);
  if (!raw) return "";

  const normalized = normalizeKey(raw);
  if (!normalized) return "";

  if (COUNTRY_ALIASES.has(normalized)) {
    return COUNTRY_ALIASES.get(normalized);
  }

  for (const country of COUNTRY_ORDER) {
    const key = normalizeKey(country);
    if (normalized === key) return country;
    if (new RegExp(`\\b${key}\\b`, "i").test(normalized)) return country;
  }

  return "";
}

function extractSiteFromHeader(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const match = raw.match(/\(([^)]+)\)/);
  return match ? normalizeText(match[1]) : "";
}

function detectWideCountryColumns(columns) {
  return columns
    .map((column) => {
      const country = canonicalizeCountry(column);
      if (!country) return null;
      return { column, country, site: extractSiteFromHeader(column) };
    })
    .filter(Boolean);
}

function detectField(columns, rows, kind) {
  const byName = columns.find((column) => FIELD_MATCHERS[kind].test(column));
  if (byName) return byName;

  const sample = rows.slice(0, 100);
  if (kind === "maturity") {
    return columns.find((column) => sample.filter((row) => parseMaturity(row[column]).score != null).length >= Math.max(4, Math.floor(sample.length * 0.25))) || "";
  }

  if (kind === "risk") {
    return columns.find((column) => sample.filter((row) => parseExplicitRisk(row[column]) != null).length >= Math.max(3, Math.floor(sample.length * 0.2))) || "";
  }

  if (kind === "country") {
    const threshold = Math.max(3, Math.floor(sample.length * 0.25));
    const ranked = columns
      .map((column) => {
        const matches = sample.filter((row) => canonicalizeCountry(row[column])).length;
        return { column, matches };
      })
      .sort((left, right) => right.matches - left.matches);

    if (ranked[0] && ranked[0].matches >= threshold) {
      return ranked[0].column;
    }

    return "";
  }

  return "";
}

function findFieldMap(rows) {
  const columns = getColumns(rows);
  return {
    columns,
    wideCountryColumns: detectWideCountryColumns(columns),
    country: detectField(columns, rows, "country"),
    site: detectField(columns, rows, "site"),
    domain: detectField(columns, rows, "domain"),
    control: detectField(columns, rows, "control"),
    maturity: detectField(columns, rows, "maturity"),
    risk: detectField(columns, rows, "risk"),
    automation: detectField(columns, rows, "automation")
  };
}

function buildSheetFieldMaps(rows) {
  const grouped = groupBy(rows, (row) => row.__sheetName || "Workbook");
  const mappings = {};
  for (const [sheetName, sheetRows] of grouped.entries()) {
    mappings[sheetName] = findFieldMap(sheetRows);
  }
  return mappings;
}

function resolveValue(row, primaryField, fallbackFields) {
  const fields = [primaryField].concat(fallbackFields || []).filter(Boolean);
  for (const field of fields) {
    const value = normalizeText(row[field]);
    if (value) return value;
  }
  return "";
}

function inferControlText(row, excludedFields) {
  let best = "";
  for (const [field, value] of Object.entries(row)) {
    if (field === "__sheetName" || excludedFields.has(field)) continue;
    const text = normalizeText(value);
    if (!/^\d+(\.\d+)?$/.test(text) && text.length > best.length) {
      best = text;
    }
  }
  return best;
}

function normalizeRows(rows, fieldOverrides, sheetFieldMaps) {
  return rows
    .filter(hasRowContent)
    .flatMap((row, index) => {
      const sheetName = row.__sheetName || "Workbook";
      const sheetMap = sheetFieldMaps[sheetName] || {};
      const effectiveFieldMap = {
        country: fieldOverrides.country || sheetMap.country || "",
        site: fieldOverrides.site || sheetMap.site || "",
        domain: fieldOverrides.domain || sheetMap.domain || "",
        control: fieldOverrides.control || sheetMap.control || "",
        maturity: fieldOverrides.maturity || sheetMap.maturity || "",
        risk: fieldOverrides.risk || sheetMap.risk || "",
        automation: sheetMap.automation || ""
      };

      const wideCountryColumns = Array.isArray(sheetMap.wideCountryColumns) ? sheetMap.wideCountryColumns : [];

      const excludedFields = new Set(Object.values(effectiveFieldMap).filter(Boolean));
      const domainFromSheet = canonicalizeDomain(row.__sheetName || "");
      const domainSeed = resolveValue(row, effectiveFieldMap.domain, []) || resolveValue(row, effectiveFieldMap.control, []);
      const domain = domainFromSheet !== "Other" ? domainFromSheet : canonicalizeDomain(domainSeed || row.__sheetName);
      const control = resolveValue(row, effectiveFieldMap.control, []) || inferControlText(row, excludedFields) || `${domain} Finding ${index + 1}`;

      const maturityLooksLikeWideColumn = wideCountryColumns.some((wideColumn) => wideColumn.column === effectiveFieldMap.maturity);
      const shouldUseWideFormat = wideCountryColumns.length >= 2 && (!effectiveFieldMap.country || maturityLooksLikeWideColumn);

      if (shouldUseWideFormat) {
        const wideRecords = wideCountryColumns
          .map((wideColumn) => {
            const rawMaturity = resolveValue(row, wideColumn.column, []);
            const maturity = parseMaturity(rawMaturity);
            const riskScore = parseRisk(resolveValue(row, effectiveFieldMap.risk, []), maturity.score);
            const automated = parseAutomationStatus(resolveValue(row, effectiveFieldMap.automation, []));
            const site = wideColumn.site || resolveValue(row, effectiveFieldMap.site, []) || "Unspecified Site";

            return {
              country: wideColumn.country,
              site,
              domain,
              control,
              maturityLabel: maturity.label,
              maturityScore: maturity.score,
              applicable: maturity.applicable,
              riskScore,
              automated,
              gapToTarget: maturity.score != null && maturity.score > 0 ? Math.max(0, TARGET_SCORE - maturity.score) : 0,
              sheetName
            };
          })
          .filter(Boolean);

        if (wideRecords.length > 0) return wideRecords;
      }

      const maturity = parseMaturity(resolveValue(row, effectiveFieldMap.maturity, []));
      const riskScore = parseRisk(resolveValue(row, effectiveFieldMap.risk, []), maturity.score);
      const automated = parseAutomationStatus(resolveValue(row, effectiveFieldMap.automation, []));
      const country = canonicalizeCountry(resolveValue(row, effectiveFieldMap.country, [])) || "Unspecified Country";
      const site = resolveValue(row, effectiveFieldMap.site, []) || "Unspecified Site";

      return [{
        country,
        site,
        domain,
        control,
        maturityLabel: maturity.label,
        maturityScore: maturity.score,
        applicable: maturity.applicable,
        riskScore,
        automated,
        gapToTarget: maturity.score != null && maturity.score > 0 ? Math.max(0, TARGET_SCORE - maturity.score) : 0,
        sheetName
      }];
    })
    .filter((record) => DOMAIN_DEFINITIONS.some((domain) => domain.key === record.domain));
}

function buildOverview(records) {
  const assessed = records.filter((record) => record.applicable && record.maturityScore != null);
  const belowStandard = assessed.filter((record) => record.maturityScore < TARGET_SCORE);
  const highRisk = records.filter((record) => (record.riskScore || 0) >= 4);
  const countries = getOrderedCountries(records);
  const heatmapRows = countries.map((country) => {
    const cells = DOMAIN_DEFINITIONS.map((domain) => {
      const scoped = records.filter((record) => record.domain === domain.key && record.country === country && record.applicable);
      const score = average(scoped.map((record) => record.maturityScore));
      const band = getMaturityBand(score);
      return { domain: domain.key, score, label: band.label, className: band.className };
    });

    const overallScore = average(cells.map((cell) => cell.score));
    const overallBand = getMaturityBand(overallScore);
    return {
      country,
      cells,
      overall: { score: overallScore, label: overallBand.label, className: overallBand.className }
    };
  });

  const overallStatusRows = DOMAIN_DEFINITIONS.map((domain) => {
    const scoped = records.filter((record) => record.domain === domain.key && record.applicable);
    const score = average(scoped.map((record) => record.maturityScore));
    const band = getMaturityBand(score);
    const concern = [...scoped]
      .filter((record) => record.maturityScore < TARGET_SCORE)
      .sort((left, right) => (right.gapToTarget - left.gapToTarget) || ((right.riskScore || 0) - (left.riskScore || 0)))[0];

    return {
      domain: domain.label,
      statusLabel: band.label,
      className: band.className,
      keyConcern: concern ? concern.control : "No major gap observed"
    };
  });

  const siteRiskRanking = [...groupBy(records.filter((record) => record.domain === "Physical Security" && record.site !== "Unspecified Site"), (record) => `${record.country}||${record.site}`).entries()]
    .map(([compositeKey, siteRows]) => {
      const [country, site] = compositeKey.split("||");
      const score = average(siteRows.map((record) => record.riskScore));
      const riskClass = score == null ? "score-na" : score >= 4 ? "score-red" : score >= 3 ? "score-orange" : "score-green";
      const riskLabel = score == null ? "No Data" : score >= 4 ? "High" : score >= 3 ? "Medium" : "Low";
      return {
        country,
        site,
        score,
        riskClass,
        riskLabel
      };
    })
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 10)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    summary: {
      records: records.length,
      countries: new Set(records.map((record) => record.country)).size,
      averageScore: average(assessed.map((record) => record.maturityScore)),
      coverage: assessed.length > 0 ? (assessed.filter((record) => record.maturityScore >= TARGET_SCORE).length / assessed.length) * 100 : 0,
      belowStandard: belowStandard.length,
      highRisk: highRisk.length
    },
    countries,
    heatmapRows,
    overallStatusRows,
    siteRiskRanking,
    globalGaps: belowStandard.sort((left, right) => (right.gapToTarget - left.gapToTarget) || ((right.riskScore || 0) - (left.riskScore || 0)))
  };
}

function buildDomainAnalysis(records, domainKey) {
  const scoped = records.filter((record) => record.domain === domainKey);
  const assessed = scoped.filter((record) => record.applicable && record.maturityScore != null);
  const belowStandard = assessed.filter((record) => record.maturityScore < TARGET_SCORE)
    .sort((left, right) => (right.gapToTarget - left.gapToTarget) || ((right.riskScore || 0) - (left.riskScore || 0)));
  const countries = getOrderedCountries(scoped);
  const countryComparison = countries.map((country) => {
    const countryRows = assessed.filter((record) => record.country === country);
    return { country, score: average(countryRows.map((record) => record.maturityScore)) || 0 };
  });

  const riskRanking = [...scoped]
    .filter((record) => record.riskScore != null)
    .sort((left, right) => (right.riskScore - left.riskScore) || ((left.maturityScore || 0) - (right.maturityScore || 0)))
    .slice(0, 8);

  const riskMatrixRows = [...groupBy(scoped.filter((record) => record.riskScore != null), (record) => record.control).entries()]
    .map(([control, controlRows]) => ({
      control,
      averageRisk: average(controlRows.map((record) => record.riskScore)) || 0,
      cells: countries.map((country) => {
        const countryRows = controlRows.filter((record) => record.country === country);
        return {
          country,
          riskScore: average(countryRows.map((record) => record.riskScore)),
          maturityScore: average(countryRows.filter((record) => record.applicable).map((record) => record.maturityScore))
        };
      })
    }))
    .sort((left, right) => right.averageRisk - left.averageRisk)
    .slice(0, 8);

  return {
    key: domainKey,
    records: scoped.length,
    countries: countries.length,
    averageScore: average(assessed.map((record) => record.maturityScore)),
    coverage: assessed.length > 0 ? (assessed.filter((record) => record.maturityScore >= TARGET_SCORE).length / assessed.length) * 100 : 0,
    belowStandardCount: belowStandard.length,
    highRiskCount: scoped.filter((record) => (record.riskScore || 0) >= 4).length,
    countryComparison,
    belowStandardControls: belowStandard.slice(0, 5),
    gapRows: belowStandard,
    riskRanking,
    riskMatrixCountries: countries,
    riskMatrixRows
  };
}

function analyzeWorkbook(rows, fieldOverrides, sheetFieldMaps, validationRows = []) {
  const records = normalizeRows(rows, fieldOverrides, sheetFieldMaps);
  const overview = buildOverview(records);
  const tabs = DOMAIN_DEFINITIONS.map((domain) => buildDomainAnalysis(records, domain.key));

  return { records, overview, tabs, validationSummary: buildValidationSummary(validationRows), warnings: [] };
}

function isValidationPositive(value) {
  const text = normalizeKey(value);
  if (!text) return false;
  return !/^(0(?:\.0+)?|no|n|false|none|pending|planned|not applicable|not certified|not audited|not completed|na|n a)$/.test(text)
    && !/^no\b|^not\s/.test(text);
}

function buildValidationSummary(rows) {
  const columns = getColumns(rows);
  const findColumn = (pattern) => columns.find((column) => pattern.test(column)) || "";
  const countCountries = (countryRows) => new Set(countryRows.map((row) => normalizeKey(row.country))).size;
  const assessmentColumn = findColumn(/included.*assessment|assessment.*included|assessment\s+scope|in\s+assessment/i);
  const internalColumn = findColumn(/internal.*audit|audit.*internal/i);
  const externalColumn = findColumn(/external.*audit|audit.*external/i);
  const certifiedColumn = findColumn(/certif|iso\s*27001/i);
  const statusColumns = new Set([assessmentColumn, internalColumn, externalColumn, certifiedColumn].filter(Boolean));
  const countryColumn = columns.find((column) => {
    if (statusColumns.has(column)) return false;
    const normalizedColumn = normalizeKey(column);
    return /^(country|countries|country name|country region|market|nation|region)$/.test(normalizedColumn);
  }) || "";
  const countColumnCountries = (column) => {
    if (!column) return 0;
    return new Set(rows.map((row) => normalizeKey(row[column])).filter(Boolean)).size;
  };

  if (!countryColumn) {
    return {
      assessmentCountries: countColumnCountries(assessmentColumn),
      certifiedCountries: countColumnCountries(certifiedColumn),
      internalAuditCountries: countColumnCountries(internalColumn),
      externalAuditCountries: countColumnCountries(externalColumn),
      hasFields: statusColumns.size > 0
    };
  }

  const countryRows = rows
    .map((row) => ({
      country: countryColumn ? normalizeText(row[countryColumn]) : "",
      assessment: assessmentColumn ? row[assessmentColumn] : "",
      internal: internalColumn ? row[internalColumn] : "",
      external: externalColumn ? row[externalColumn] : "",
      certified: certifiedColumn ? row[certifiedColumn] : ""
    }))
    .filter((row) => row.country);

  return {
    assessmentCountries: countCountries(assessmentColumn ? countryRows.filter((row) => isValidationPositive(row.assessment)) : countryRows),
    certifiedCountries: countCountries(countryRows.filter((row) => isValidationPositive(row.certified))),
    internalAuditCountries: countCountries(countryRows.filter((row) => isValidationPositive(row.internal))),
    externalAuditCountries: countCountries(countryRows.filter((row) => isValidationPositive(row.external))),
    hasFields: Boolean(countryColumn && (assessmentColumn || internalColumn || externalColumn || certifiedColumn))
  };
}

function findAssessmentSheets(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) return [];
  const matchingNames = workbook.SheetNames.filter((sheetName) => /internal\s+audit|external\s+audit|certif/i.test(sheetName));
  if (matchingNames.length > 0) return matchingNames;

  return workbook.SheetNames.filter((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return false;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }).slice(0, 12);
    const text = rows.flat().join(" ");
    return /internal\s+audit|external\s+audit|certif/i.test(text);
  });
}

function readValidationRows(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) return [];
  const sheetName = workbook.SheetNames.find((name) => /audit\s+information/i.test(normalizeText(name)));
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const headerRowIndex = matrix
    .slice(0, 40)
    .map((row, index) => {
      const cells = row.map(normalizeKey);
      const hasCountry = cells.some((cell) => /country|countries|market|nation|region/.test(cell));
      const statusFields = cells.filter((cell) => /assessment|internal.*audit|audit.*internal|external.*audit|audit.*external|certif|iso 27001/.test(cell)).length;
      return { index, score: (hasCountry ? 3 : 0) + statusFields };
    })
    .sort((left, right) => right.score - left.score)[0];

  const range = headerRowIndex && headerRowIndex.score >= 4 ? headerRowIndex.index : 0;
  return XLSX.utils.sheet_to_json(sheet, { range, raw: true, defval: null })
    .map((row) => ({ ...row, __sheetName: sheetName }));
}

function readWorkbookRows(workbook, scope) {
  if (!workbook) return [];
  const assessmentSheets = findAssessmentSheets(workbook);
  const sheetNames = scope === ALL_SHEETS
    ? workbook.SheetNames
    : scope === ASSESSMENT_SHEETS
      ? (assessmentSheets.length > 0 ? assessmentSheets : workbook.SheetNames)
      : [scope];
  return sheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { raw: true, defval: null }).map((row) => ({ ...row, __sheetName: sheetName }));
  });
}

const embeddedWorkbookCache = {};

function getEmbeddedWorkbook(year) {
  const cacheKey = String(year);
  if (embeddedWorkbookCache[cacheKey]) return embeddedWorkbookCache[cacheKey];

  const base64 = window.EMBEDDED_WORKBOOKS && window.EMBEDDED_WORKBOOKS[cacheKey];
  if (!base64) throw new Error(`No bundled data found for ${year}. Make sure embedded-data.js is loaded.`);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  embeddedWorkbookCache[cacheKey] = workbook;
  return workbook;
}

function computeCountryComparisonRows(workbook) {
  const rows = readWorkbookRows(workbook, ALL_SHEETS);
  const sheetFieldMaps = buildSheetFieldMaps(rows);
  const validationRows = readValidationRows(workbook);
  const emptyOverrides = { country: "", site: "", domain: "", control: "", maturity: "", risk: "" };
  const analysis = analyzeWorkbook(rows, emptyOverrides, sheetFieldMaps, validationRows);
  return analysis.overview.heatmapRows.map((row) => ({ country: row.country, score: row.overall.score || 0 }));
}

function ChartCanvas(props) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !props.config) return undefined;
    const chart = new Chart(canvasRef.current, props.config);
    return () => chart.destroy();
  }, [props.config]);

  return h("canvas", { ref: canvasRef, id: props.id });
}

function KpiGrid(props) {
  return h(
    "div",
    { className: "kpi-grid" },
    props.items.map((item) => h(
      "article",
      { className: "kpi-card", key: item.label },
      h("p", { className: "kpi-label" }, item.label),
      h("p", { className: "kpi-value" }, item.value),
      h("p", { className: "kpi-note" }, item.note || "")
    ))
  );
}

function DashboardInsights(props) {
  const domainRows = props.analysis.tabs.map((tab) => ({
    country: tab.key,
    score: tab.averageScore || 0
  }));
  const maturityCounts = MATURITY_LEVELS.map((level) => ({
    label: level.label,
    count: props.analysis.records.filter((record) => record.maturityLabel === level.label).length,
    color: level.color
  }));

  return h(React.Fragment, null,
    h("article", { className: "panel" },
      h("div", { className: "panel-head" }, h("div", null,
        h("h2", null, "Maturity level distribution"),
        h("p", null, "Number of controls at each maturity level.")
      )),
      h("div", { className: "maturity-chart-shell" }, h(MaturityLevelChart, { id: "overview-maturity-level-chart", rows: maturityCounts }))
    ),
    h("article", { className: "panel" },
      h("div", { className: "panel-head" }, h("div", null,
        h("h2", null, "Domain maturity"),
        h("p", null, "Average maturity score for each assessed domain.")
      )),
      h("div", { className: "country-chart-shell" }, h(CountryComparisonChart, { id: "overview-domain-chart", rows: domainRows }))
    ),
    h("article", { className: "panel wide" },
      h("div", { className: "panel-head" }, h("div", null,
        h("h2", null, "Country comparison"),
        h("p", null, "Overall maturity score by country.")
      ), h("div", { className: "year-toggle" },
        Object.keys(YEAR_DATA_FILES).map((year) => h("button", {
          key: year,
          type: "button",
          className: `year-button${String(props.activeYear) === year ? " active" : ""}`,
          onClick: () => props.onSelectYear && props.onSelectYear(Number(year))
        }, year))
      )),
      h("div", { className: "country-chart-shell" }, h(CountryComparisonChart, { id: "overview-country-chart", rows: props.countryComparisonRows }))
    )
  );
}

function MaturityLevelChart(props) {
  const rows = props.rows.filter((row) => row.label !== "No Data");
  const percentageLabelPlugin = {
    id: `${props.id}-percentages`,
    afterDatasetsDraw(chart) {
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      const total = dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
      if (!dataset || !meta || total === 0) return;

      const context = chart.ctx;
      context.save();
      context.fillStyle = "#ffffff";
      context.font = '600 11px "IBM Plex Mono", Consolas, monospace';
      context.textAlign = "center";
      context.textBaseline = "middle";
      meta.data.forEach((arc, index) => {
        const percentage = (Number(dataset.data[index] || 0) / total) * 100;
        if (percentage < 4) return;
        const point = arc.getCenterPoint();
        context.fillText(`${percentage.toFixed(1)}%`, point.x, point.y);
      });
      context.restore();
    }
  };
  const config = {
    type: "doughnut",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        label: "Controls",
        data: rows.map((row) => row.count),
        backgroundColor: rows.map((row) => row.color),
        borderColor: "#ffffff",
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: "#33463b",
            padding: 12,
            usePointStyle: true,
            pointStyle: "circle",
            font: { family: "IBM Plex Mono, Consolas, monospace", size: 11, weight: "600" }
          }
        },
        tooltip: {
          backgroundColor: "rgba(16, 33, 24, 0.95)",
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
              const percentage = total > 0 ? (Number(context.parsed || 0) / total) * 100 : 0;
              return `${context.label}: ${formatInt(context.parsed)} controls (${percentage.toFixed(1)}%)`;
            }
          }
        }
      },
      cutout: "58%"
    },
    plugins: [percentageLabelPlugin]
  };

  return h(ChartCanvas, { id: props.id, config });
}

function Legend() {
  const items = [
    { label: "Initial", className: "score-red" },
    { label: "Defined", className: "score-orange" },
    { label: "Standard", className: "score-green" },
    { label: "Advanced", className: "score-green" },
    { label: "No Data", className: "score-na" }
  ];

  return h(
    "div",
    { className: "legend" },
    items.map((item) => h(
      "span",
      { className: "legend-chip", key: item.label },
      h("i", { className: item.className }),
      item.label
    ))
  );
}

function OverviewHeatmap(props) {
  return h(
    "div",
    { className: "table-wrap heatmap-wrap" },
    h(
      "table",
      { className: "distribution-table heatmap-table", "aria-label": "Country maturity heatmap" },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", null, "Country"),
          DOMAIN_DEFINITIONS.map((domain) => h("th", { key: domain.key }, domain.key === "Supply Chain Security" ? "Supply Chain" : domain.key)),
          h("th", null, "Overall")
        )
      ),
      h(
        "tbody",
        null,
        props.rows.map((row) => h(
          "tr",
          { key: row.country },
          h("td", null, row.country),
          row.cells.map((cell) => h(
            "td",
            {
              key: `${row.country}-${cell.domain}`,
              className: "heatmap-cell",
              title: `${row.country} / ${cell.domain}: ${cell.label}${cell.score != null ? ` | score ${formatScore(cell.score)}` : ""}`
            },
            h("span", { className: "heatmap-cell-inner" }, h("span", { className: `status-dot ${cell.className}`, "aria-label": cell.label }))
          )),
          h(
            "td",
            {
              className: "heatmap-cell",
              title: `${row.country} / Overall: ${row.overall.label}${row.overall.score != null ? ` | score ${formatScore(row.overall.score)}` : ""}`
            },
            h("span", { className: "heatmap-cell-inner" }, h("span", { className: `status-dot ${row.overall.className}`, "aria-label": row.overall.label }))
          )
        ))
      )
    )
  );
}

function OverallStatusTable(props) {
  return h(
    "div",
    { className: "table-wrap" },
    h(
      "table",
      { className: "distribution-table", "aria-label": "Overall maturity status table" },
      h("thead", null, h("tr", null, h("th", null, "Domain"), h("th", null, "Overall Status"), h("th", null, "Key Concern"))),
      h(
        "tbody",
        null,
        props.rows.map((row) => h(
          "tr",
          { key: row.domain },
          h("td", null, row.domain),
          h("td", null, h("span", { className: `badge ${row.className}` }, row.statusLabel)),
          h("td", null, row.keyConcern)
        ))
      )
    )
  );
}

function SiteRiskRankingTable(props) {
  return h(
    "div",
    { className: "table-wrap" },
    h(
      "table",
      { className: "distribution-table", "aria-label": "Site risk ranking table" },
      h("thead", null, h("tr", null, h("th", null, "Rank"), h("th", null, "Site"), h("th", null, "Risk Level"))),
      h(
        "tbody",
        null,
        props.rows.length === 0
          ? h("tr", null, h("td", { colSpan: 3 }, "No physical security site risk data found."))
          : props.rows.map((row) => h(
            "tr",
            { key: `${row.country}-${row.site}` },
            h("td", null, String(row.rank)),
            h("td", null, `${row.country} (${row.site})`),
            h("td", null, h("span", { className: `badge ${row.riskClass}` }, row.riskLabel))
          ))
      )
    )
  );
}

function GapTable(props) {
  return h(
    "div",
    { className: "table-wrap" },
    h(
      "table",
      { className: "distribution-table gap-table", "aria-label": props.ariaLabel },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          props.includeDomain ? h("th", null, "Domain") : null,
          h("th", null, "Country"),
          h("th", null, "Finding"),
          h("th", null, "Maturity"),
          h("th", null, "Score")
        )
      ),
      h(
        "tbody",
        null,
        props.rows.length === 0
          ? h("tr", null, h("td", { colSpan: props.includeDomain ? 5 : 4 }, props.emptyMessage))
          : props.rows.map((row, index) => h(
            "tr",
            { key: `${row.domain || "domain"}-${row.country}-${index}` },
            props.includeDomain ? h("td", null, row.domain) : null,
            h("td", null, row.country),
            h("td", null, row.control),
            h("td", null, h("span", { className: `badge ${getMaturityBand(row.maturityScore).className}` }, row.maturityLabel)),
            h("td", null, formatScore(row.maturityScore))
          ))
      )
    )
  );
}

function getFilteredGapRows(rows, filters) {
  return rows.filter((row) => {
    const matchesDomain = !filters.domain || row.domain === filters.domain;
    const matchesCountry = !filters.country || row.country === filters.country;
    const matchesFinding = !filters.finding || normalizeText(row.control).toLowerCase().includes(filters.finding.toLowerCase());
    return matchesDomain && matchesCountry && matchesFinding;
  });
}

function GapFilters(props) {
  const domains = [...new Set(props.rows.map((row) => row.domain).filter(Boolean))].sort();
  const countries = [...new Set(props.rows.map((row) => row.country).filter(Boolean))].sort();
  return h("div", { className: "gap-filters", "aria-label": "Gap analysis filters" },
    h("label", null, "Domain",
      h("select", { value: props.filters.domain, onChange: (event) => props.onChange({ ...props.filters, domain: event.target.value }) },
        h("option", { value: "" }, "All domains"),
        domains.map((item) => h("option", { key: item, value: item }, item))
      )
    ),
    h("label", null, "Country",
      h("select", { value: props.filters.country, onChange: (event) => props.onChange({ ...props.filters, country: event.target.value }) },
        h("option", { value: "" }, "All countries"),
        countries.map((item) => h("option", { key: item, value: item }, item))
      )
    ),
    h("label", null, "Finding",
      h("input", { type: "search", value: props.filters.finding, placeholder: "Search findings", onChange: (event) => props.onChange({ ...props.filters, finding: event.target.value }) })
    ),
    h("span", { className: "gap-filter-count" }, `${formatInt(props.filteredRows.length)} of ${formatInt(props.rows.length)} findings`)
  );
}

function GapAnalysisPanel(props) {
  const [localFilters, setLocalFilters] = useState({ domain: "", country: "", finding: "" });
  const filters = props.filters || localFilters;
  const filteredRows = getFilteredGapRows(props.rows, filters);
  const updateFilters = props.onFiltersChange || setLocalFilters;

  return h("div", null,
    h(GapFilters, { rows: props.rows, filters, filteredRows, onChange: updateFilters }),
    h(GapTable, { ...props, rows: filteredRows })
  );
}

function OverviewGapSection(props) {
  const [filters, setFilters] = useState({ domain: "", country: "", finding: "" });
  const selectedDomain = props.tabs.find((tab) => tab.key === filters.domain);
  const scopedRecords = selectedDomain
    ? props.records.filter((record) => record.domain === filters.domain && (!filters.country || record.country === filters.country))
    : [];
  const assessedRecords = scopedRecords.filter((record) => record.applicable && record.maturityScore != null);
  const scopedBelowStandard = assessedRecords.filter((record) => record.maturityScore < TARGET_SCORE);
  const scopedCoverage = assessedRecords.length > 0
    ? (assessedRecords.filter((record) => record.maturityScore >= TARGET_SCORE).length / assessedRecords.length) * 100
    : 0;
  const scopedComparison = selectedDomain?.countryComparison || [];
  const scopeLabel = filters.country ? `${filters.country} / ${selectedDomain?.key}` : selectedDomain?.key;
  const hasScopedData = scopedRecords.length > 0;

  return h("div", null,
    h(GapAnalysisPanel, { ...props, filters, onFiltersChange: setFilters }),
    h("div", { className: "selected-domain-layout" },
      selectedDomain
        ? h("article", { className: "panel" },
          h("div", { className: "panel-head" }, h("div", null,
            h("h3", null, `${scopeLabel} KPI cards`),
            h("p", null, filters.country ? `Summary for ${filters.country} in the selected domain.` : "Summary for the selected domain.")
          )),
          hasScopedData
            ? h(KpiGrid, {
              items: [
                { label: "Assessed Records", value: formatInt(assessedRecords.length), note: filters.country || `${formatInt(selectedDomain.countries)} countries` },
                { label: "At Or Above Standard", value: formatPercent(scopedCoverage), note: "Standard + Advanced" },
                { label: "Controls Below Standard", value: formatInt(scopedBelowStandard.length), note: "Initial + Defined" }
              ]
            })
            : h("div", { className: "empty-state" }, `No data found for ${scopeLabel}.`)
        )
        : h("article", { className: "panel selected-domain-empty" },
          h("h3", null, "Select a domain"),
          h("p", null, "Choose a domain in the Gap Analysis filter to compare all countries and view its KPI cards.")
        ),
      selectedDomain
        ? h("article", { className: "panel" },
          h("div", { className: "panel-head" }, h("div", null,
            h("h3", null, `${selectedDomain.key} maturity comparison`),
            h("p", null, "Average maturity across all countries for the selected domain.")
          )),
          h("div", { className: "country-chart-shell" }, h(CountryComparisonChart, { id: "selected-domain-country-chart", rows: scopedComparison }))
        )
        : null
    )
  );
}

function FindingsList(props) {
  if (props.items.length === 0) {
    return h("div", { className: "empty-state" }, props.emptyMessage);
  }

  return h(
    "div",
    { className: "insight-list" },
    props.items.map((item, index) => h(
      "div",
      { className: "insight-item", key: `${item.control}-${index}` },
      h("strong", null, item.control),
      h("div", { className: "insight-meta" }, `${item.country} · ${item.site} · ${item.sheetName} · ${item.maturityLabel} (${formatScore(item.maturityScore)}) · gap ${formatScore(item.gapToTarget)} · risk ${item.riskScore != null ? formatScore(item.riskScore) : "-"}`)
    ))
  );
}

function RiskRankingList(props) {
  if (props.items.length === 0) {
    return h("div", { className: "empty-state" }, "No risk ranking data found for this tab.");
  }

  return h(
    "div",
    { className: "insight-list" },
    props.items.map((item, index) => h(
      "div",
      { className: "insight-item", key: `${item.control}-${index}` },
      h("strong", null, `${index + 1}. ${item.control}`),
      h("div", { className: "insight-meta" }, `${item.country} · ${item.site} · ${item.sheetName} · risk ${formatScore(item.riskScore)} · maturity ${item.maturityLabel}`)
    ))
  );
}

function RiskHeatmap(props) {
  return h(
    "div",
    { className: "table-wrap heatmap-wrap" },
    h(
      "table",
      { className: "distribution-table risk-matrix", "aria-label": props.ariaLabel },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", null, "Control"),
          props.countries.map((country) => h("th", { key: country }, country))
        )
      ),
      h(
        "tbody",
        null,
        props.rows.length === 0
          ? h("tr", null, h("td", { colSpan: Math.max(2, props.countries.length + 1) }, "No risk heatmap data found for this tab."))
          : props.rows.map((row) => h(
            "tr",
            { key: row.control },
            h("td", null, row.control),
            row.cells.map((cell) => {
              const riskClass = cell.riskScore == null ? "" : cell.riskScore >= 4 ? "risk-high" : cell.riskScore >= 3 ? "risk-medium" : "risk-low";
              return h(
                "td",
                {
                  key: `${row.control}-${cell.country}`,
                  className: `risk-cell ${riskClass}`.trim(),
                  title: `${row.control} / ${cell.country}${cell.riskScore != null ? ` | risk ${formatScore(cell.riskScore)}` : ""}${cell.maturityScore != null ? ` | maturity ${formatScore(cell.maturityScore)}` : ""}`
                },
                h("span", { className: "risk-cell-inner" }, cell.riskScore != null ? formatScore(cell.riskScore) : "-")
              );
            })
          ))
      )
    )
  );
}

function CountryComparisonChart(props) {
  const valueLabelPlugin = {
    id: `${props.id}-value-labels`,
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      if (!dataset || !meta) return;

      const targetY = chart.scales.y.getPixelForValue(TARGET_SCORE);

      ctx.save();
      ctx.fillStyle = "#102118";
      ctx.font = '600 11px "IBM Plex Mono", Consolas, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value == null || Number.isNaN(value)) return;
        // Always keep the label above the dashed target line, even for bars shorter than the target.
        const labelY = Math.min(bar.y, targetY) - 6;
        ctx.fillText(formatScore(value), bar.x, labelY);
      });

      ctx.restore();
    }
  };

  const config = {
    type: "bar",
    data: {
      labels: props.rows.map((item) => item.country),
      datasets: [
        {
          type: "bar",
          label: "Average maturity score",
          data: props.rows.map((item) => item.score),
          backgroundColor: props.rows.map((item) => {
            const score = Number(item.score || 0);
            if (score >= TARGET_SCORE) return "#157347";
            if (score >= 40) return "#ea8c19";
            return "#d92d20";
          }),
          borderColor: "#ffffff",
          borderWidth: 1.5,
          hoverBorderWidth: 2,
          borderRadius: 10,
          maxBarThickness: 52,
          minBarLength: 12
        },
        {
          type: "line",
          label: "Standard target",
          data: props.rows.map(() => TARGET_SCORE),
          borderColor: "#157347",
          backgroundColor: "#157347",
          borderDash: [6, 6],
          borderWidth: 2.2,
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#33463b",
            boxWidth: 14,
            boxHeight: 14,
            padding: 16,
            font: {
              family: "IBM Plex Mono, Consolas, monospace",
              size: 11,
              weight: "600"
            }
          }
        },
        tooltip: {
          backgroundColor: "rgba(16, 33, 24, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#f3f8f2",
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatScore(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#33463b",
            font: {
              family: "IBM Plex Mono, Consolas, monospace",
              size: 11,
              weight: "600"
            }
          }
        },
        y: {
          beginAtZero: true,
          max: 80,
          grid: {
            color: "rgba(101, 120, 110, 0.18)",
            lineWidth: 1
          },
          ticks: {
            stepSize: 20,
            color: "#65786e",
            font: {
              family: "IBM Plex Mono, Consolas, monospace",
              size: 11
            }
          }
        }
      }
    },
    plugins: [valueLabelPlugin]
  };

  return h(ChartCanvas, { id: props.id, config });
}

function DomainPanel(props) {
  const domainLabel = DOMAIN_DEFINITIONS.find((domain) => domain.key === props.tab.key).label;
  return h(
    "section",
    { className: `tab-panel${props.active ? " active" : ""}`, role: "tabpanel", "aria-hidden": String(!props.active) },
    h(
      "div",
      { className: "domain-header" },
      h("div", null, h("h2", null, domainLabel), h("p", { className: "subtle" }, `Target maturity level: Standard (${TARGET_SCORE}).`))
    ),
    h(KpiGrid, {
      items: [
        { label: "Assessed Records", value: formatInt(props.tab.records), note: `${formatInt(props.tab.countries)} countries` },
        { label: "Average Maturity", value: formatScore(props.tab.averageScore), note: "Initial=20, Defined=40, Standard=60, Advanced=80" },
        { label: "At Or Above Standard", value: formatPercent(props.tab.coverage), note: "Standard + Advanced" },
        { label: "Controls Below Standard", value: formatInt(props.tab.belowStandardCount), note: "Initial + Defined" },
        { label: "High Risk Findings", value: formatInt(props.tab.highRiskCount), note: "Risk score >= 4" }
      ]
    }),
    h(
      "div",
      { className: "domain-grid" },
      h(
        "article",
        { className: "panel" },
        h("div", { className: "panel-head" }, h("div", null, h("h3", null, "Country Comparison Chart"), h("p", null, "Average maturity score by country."))),
        h("div", { className: "country-chart-shell" }, h(CountryComparisonChart, { id: `${props.tab.key}-country-chart`, rows: props.tab.countryComparison }))
      ),
      h(
        "article",
        { className: "panel" },
        h("div", { className: "panel-head" }, h("div", null, h("h3", null, "Controls Below Standard"), h("p", null, "Highest-priority below-target controls."))),
        h(FindingsList, { items: props.tab.belowStandardControls, emptyMessage: "No below-standard controls found for this tab." })
      ),
    )
  );
}

function App() {
  const [workbook, setWorkbook] = useState(null);
  const [sheetScope, setSheetScope] = useState(ALL_SHEETS);
  const [activeRows, setActiveRows] = useState([]);
  const [autoFields, setAutoFields] = useState({ columns: [], country: "", site: "", domain: "", control: "", maturity: "", risk: "" });
  const [sheetFieldMaps, setSheetFieldMaps] = useState({});
  const [fieldOverrides, setFieldOverrides] = useState({ country: "", site: "", domain: "", control: "", maturity: "", risk: "" });
  const [fileName, setFileName] = useState("No file loaded");
  const [status, setStatus] = useState({ message: "Loading 2026 assessment data...", isError: false });
  const [activeTab, setActiveTab] = useState(DOMAIN_DEFINITIONS[0].key);
  const [countryYear, setCountryYear] = useState(2026);
  const [countryComparisonRows, setCountryComparisonRows] = useState([]);

  useEffect(() => {
    try {
      setCountryComparisonRows(computeCountryComparisonRows(getEmbeddedWorkbook(countryYear)));
    } catch (error) {
      setCountryComparisonRows([]);
    }
  }, [countryYear]);

  useEffect(() => {
    if (!workbook) {
      setActiveRows([]);
      setAutoFields({ columns: [], country: "", site: "", domain: "", control: "", maturity: "", risk: "" });
      setSheetFieldMaps({});
      return;
    }

    const rows = readWorkbookRows(workbook, sheetScope);
    setActiveRows(rows);
    setAutoFields(findFieldMap(rows));
    setSheetFieldMaps(buildSheetFieldMaps(rows));
  }, [workbook, sheetScope]);

  const validationRows = workbook ? readValidationRows(workbook) : [];
  const analysis = analyzeWorkbook(activeRows, fieldOverrides, sheetFieldMaps, validationRows);

  useEffect(() => {
    if (!workbook) return;
    if (activeRows.length === 0) {
      setStatus((previous) => {
        if (previous.message === "Selected workbook scope has no rows." && previous.isError) return previous;
        return { message: "Selected workbook scope has no rows.", isError: true };
      });
      return;
    }

    const lines = [`Dashboard ready for ${formatInt(analysis.records.length)} records.`];
    if (analysis.warnings.length > 0) {
      lines.push(`Notes: ${analysis.warnings.join(" ")}`);
    }
    const nextMessage = lines.join(" ");
    setStatus((previous) => {
      if (previous.message === nextMessage && !previous.isError) return previous;
      return { message: nextMessage, isError: false };
    });
  }, [workbook, activeRows.length, analysis.records.length, analysis.warnings.join("|")]);

  function applyWorkbook(nextWorkbook) {
    if (!nextWorkbook.SheetNames || nextWorkbook.SheetNames.length === 0) {
      throw new Error("Workbook has no sheets.");
    }
    setWorkbook(nextWorkbook);
    setSheetScope(ALL_SHEETS);
    setFieldOverrides({ country: "", site: "", domain: "", control: "", maturity: "", risk: "" });
  }

  // Load the bundled 2026 assessment automatically so no manual upload is required on first visit.
  useEffect(() => {
    try {
      applyWorkbook(getEmbeddedWorkbook(2026));
      setFileName(YEAR_DATA_FILES[2026]);
      setStatus({ message: "2026 workbook loaded. Building dashboard...", isError: false });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "Unable to load bundled 2026 workbook.", isError: true });
    }
  }, []);

  async function handleFileChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setStatus({ message: "Reading workbook...", isError: false });

    try {
      const extension = file.name.toLowerCase().split(".").pop();
      if (extension !== "xlsx" && extension !== "xls") {
        throw new Error("Unsupported format. Please upload an .xlsx or .xls workbook.");
      }

      const buffer = await file.arrayBuffer();
      const nextWorkbook = XLSX.read(buffer, { type: "array", cellDates: true });
      applyWorkbook(nextWorkbook);
      setStatus({ message: "Workbook loaded. Building dashboard...", isError: false });
    } catch (error) {
      setWorkbook(null);
      setActiveRows([]);
      setAutoFields({ columns: [], country: "", site: "", domain: "", control: "", maturity: "", risk: "" });
      setSheetFieldMaps({});
      setStatus({ message: error instanceof Error ? error.message : "Unable to analyze workbook.", isError: true });
    }
  }

  return h(
    React.Fragment,
    null,
    h("div", { className: "backdrop" }),
    h("div", { className: "grain" }),
    h(
      "main",
      { className: "dashboard-shell" },
      h(
        "header",
        { className: "hero" },
        h(
          "div",
          null,
          h("h1", null, "Local Security Maturity Dashboard")
        ),
      ),
      h(
        "section",
        { className: "control-panel" },
        h(
          "div",
          { className: "control-group file-picker span-two" },
          h("label", { htmlFor: "sourceInput" }, "Upload a Different Excel File (optional)"),
          h("input", { id: "sourceInput", type: "file", accept: ".xlsx,.xls", onChange: handleFileChange })
        ),
        h(
          "div",
          { className: "control-group" },
          h("label", { htmlFor: "sheetSelect" }, "Workbook Scope"),
          h(
            "select",
            { id: "sheetSelect", value: workbook ? sheetScope : "", disabled: !workbook, onChange: (event) => setSheetScope(event.target.value) },
            h("option", { value: ASSESSMENT_SHEETS }, "Internal Audit / Certification sheets"),
            h("option", { value: ALL_SHEETS }, workbook ? `All sheets (${workbook.SheetNames.length})` : "All sheets / select scope"),
            workbook ? workbook.SheetNames.map((sheetName) => h("option", { key: sheetName, value: sheetName }, sheetName)) : null
          )
        )
      ),
      h(
        "section",
        { className: "chart-grid overview-grid" },
        h(DashboardInsights, { analysis, activeYear: countryYear, onSelectYear: setCountryYear, countryComparisonRows }),
        h(
          "article",
          { className: "panel wide" },
          h("div", { className: "panel-head" }, h("div", null, h("h2", null, "Country Maturity Heatmap"), h("p", null, "Country rows with HR, Legal, Supply Chain, and Overall maturity dots.")), h(Legend)),
          h(OverviewHeatmap, { countries: analysis.overview.countries, rows: analysis.overview.heatmapRows })
        ),
        h(
          "article",
          { className: "panel wide" },
          h("div", { className: "panel-head" }, h("div", null, h("h2", null, "Gap Analysis"), h("p", null, "All controls below the Standard target across the workbook."))),
          h(OverviewGapSection, { rows: analysis.overview.globalGaps, records: analysis.records, tabs: analysis.tabs, includeDomain: true, ariaLabel: "Global gap analysis", emptyMessage: "Upload a workbook to see controls below Standard." })
        ),
      ),
      h(
        "p",
        {
          className: "status",
          style: {
            background: status.isError ? "#ffe1dd" : "#fff0d9",
            borderColor: status.isError ? "#f1a7a0" : "#f4d49e",
            color: status.isError ? "#8b1e16" : "#744210"
          }
        },
        status.message
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));